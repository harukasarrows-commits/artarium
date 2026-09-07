package com.arrows.artarium;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.contract.ActivityResultContract;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.aggregate.AggregationResultGroupedByPeriod;
import androidx.health.connect.client.records.StepsRecord;
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest;
import androidx.health.connect.client.time.TimeRangeFilter;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import kotlin.Result;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.CoroutineContext;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlin.coroutines.intrinsics.IntrinsicsKt;

/**
 * Health Connect（Android の健康データの共通倉庫）から歩数を読むプラグイン。
 *
 * 歩数を数えるのは Samsung Health や Google Fit などの別アプリで、Health Connect に
 * 書き込まれた日別の歩数をここで集計して返す。アプリを閉じている間の歩数も、
 * 数えるアプリ側が動いていればここから取り込める（2026-09-07 ユーザー選択の B 案）。
 *
 * Health Connect のクライアントは Kotlin の suspend 関数なので、Java からは
 * Continuation を手で渡して待つ（Kotlin ツールチェーンをビルドに足さないため）。
 *
 * JS からの呼び出し: window.Capacitor.nativePromise("HealthConnect", "<メソッド名>", {...})
 */
@CapacitorPlugin(name = "HealthConnect")
public class HealthConnectPlugin extends Plugin {

    static final String READ_STEPS = "android.permission.health.READ_STEPS";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // ---- suspend 関数を Java から同期的に待つための小さな仕組み ----

    private interface SuspendCall<T> {
        Object invoke(Continuation<? super T> continuation);
    }

    private static final class BlockingContinuation<T> implements Continuation<T> {
        private final CountDownLatch latch = new CountDownLatch(1);
        private Object outcome;

        @Override
        public CoroutineContext getContext() {
            return EmptyCoroutineContext.INSTANCE;
        }

        @Override
        public void resumeWith(Object result) {
            outcome = result;
            latch.countDown();
        }

        @SuppressWarnings("unchecked")
        T await(Object direct) throws Throwable {
            Object value = direct;
            if (value == IntrinsicsKt.getCOROUTINE_SUSPENDED()) {
                latch.await();
                value = outcome;
            }
            if (value instanceof Result.Failure) {
                throw ((Result.Failure) value).exception;
            }
            return (T) value;
        }
    }

    private static <T> T await(SuspendCall<T> call) throws Throwable {
        BlockingContinuation<T> continuation = new BlockingContinuation<>();
        return continuation.await(call.invoke(continuation));
    }

    // ---- 状態 ----

    private String sdkStatusName() {
        int status = HealthConnectClient.getSdkStatus(getContext());
        if (status == HealthConnectClient.SDK_AVAILABLE) return "available";
        if (status == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return "update_required";
        return "unavailable";
    }

    private boolean hasReadStepsPermission() {
        try {
            HealthConnectClient client = HealthConnectClient.getOrCreate(getContext());
            Set<String> granted = await(c -> client.getPermissionController().getGrantedPermissions(c));
            return granted != null && granted.contains(READ_STEPS);
        } catch (Throwable error) {
            return false;
        }
    }

    private JSObject statusObject() {
        JSObject result = new JSObject();
        String status = sdkStatusName();
        result.put("sdkStatus", status);
        result.put("permissionGranted", "available".equals(status) && hasReadStepsPermission());
        return result;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(statusObject());
    }

    // ---- 許可 ----

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!"available".equals(sdkStatusName())) {
            call.resolve(statusObject());
            return;
        }
        if (hasReadStepsPermission()) {
            call.resolve(statusObject());
            return;
        }
        ActivityResultContract<Set<String>, Set<String>> contract = PermissionController.createRequestPermissionResultContract();
        Set<String> wanted = new HashSet<>();
        wanted.add(READ_STEPS);
        Intent intent = contract.createIntent(getContext(), wanted);
        startActivityForResult(call, intent, "onPermissionResult");
    }

    @ActivityCallback
    private void onPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        call.resolve(statusObject());
    }

    // ---- 読み取り ----

    /** 直近 N 日（今日を含む）の日別歩数を返す。{ days: [{date, steps}], todaySteps } */
    @PluginMethod
    public void readDailySteps(PluginCall call) {
        if (!"available".equals(sdkStatusName())) {
            call.reject("Health Connect がこの端末で使えません", "UNAVAILABLE");
            return;
        }
        if (!hasReadStepsPermission()) {
            call.reject("Health Connect の歩数の読み取りが許可されていません", "PERMISSION_DENIED");
            return;
        }
        int days = Math.max(1, Math.min(31, call.getInt("days", 7)));
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.minusDays(days - 1).atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();
        try {
            HealthConnectClient client = HealthConnectClient.getOrCreate(getContext());
            AggregateGroupByPeriodRequest request = new AggregateGroupByPeriodRequest(
                Collections.singleton(StepsRecord.COUNT_TOTAL),
                TimeRangeFilter.between(start, end),
                Period.ofDays(1),
                Collections.emptySet()
            );
            List<AggregationResultGroupedByPeriod> groups = await(c -> client.aggregateGroupByPeriod(request, c));
            JSArray dayArray = new JSArray();
            long todaySteps = 0;
            String todayKey = today.format(DAY);
            if (groups != null) {
                for (AggregationResultGroupedByPeriod group : groups) {
                    Long count = group.getResult().get(StepsRecord.COUNT_TOTAL);
                    long steps = count == null ? 0 : count;
                    String date = group.getStartTime().toLocalDate().format(DAY);
                    JSObject day = new JSObject();
                    day.put("date", date);
                    day.put("steps", steps);
                    dayArray.put(day);
                    if (todayKey.equals(date)) todaySteps = steps;
                }
            }
            JSObject result = new JSObject();
            result.put("days", dayArray);
            result.put("todaySteps", todaySteps);
            result.put("readAt", System.currentTimeMillis());
            call.resolve(result);
        } catch (Throwable error) {
            call.reject("Health Connect から歩数を読み取れませんでした: " + error.getMessage(), "READ_FAILED");
        }
    }

    /**
     * 診断用: 直近 N 日の歩数レコードを生のまま数え、どのアプリが書いたかを返す。
     * 集計（aggregate）が 0 件のとき、「本当にデータが無い」のか「集計の使い方の問題」かを切り分ける。
     */
    @PluginMethod
    public void inspectRecords(PluginCall call) {
        if (!"available".equals(sdkStatusName()) || !hasReadStepsPermission()) {
            call.reject("Health Connect が使えないか、許可がありません", "UNAVAILABLE");
            return;
        }
        int days = Math.max(1, Math.min(31, call.getInt("days", 7)));
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.minusDays(days - 1).atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();
        try {
            HealthConnectClient client = HealthConnectClient.getOrCreate(getContext());
            androidx.health.connect.client.request.ReadRecordsRequest<StepsRecord> request =
                new androidx.health.connect.client.request.ReadRecordsRequest<>(
                    kotlin.jvm.JvmClassMappingKt.getKotlinClass(StepsRecord.class),
                    TimeRangeFilter.between(start, end),
                    Collections.emptySet(),
                    true,
                    1000,
                    null
                );
            androidx.health.connect.client.response.ReadRecordsResponse<StepsRecord> response =
                await(c -> client.readRecords(request, c));
            JSArray records = new JSArray();
            long total = 0;
            for (StepsRecord record : response.getRecords()) {
                JSObject item = new JSObject();
                item.put("start", record.getStartTime().toString());
                item.put("end", record.getEndTime().toString());
                item.put("count", record.getCount());
                item.put("origin", record.getMetadata().getDataOrigin().getPackageName());
                records.put(item);
                total += record.getCount();
            }
            JSObject result = new JSObject();
            result.put("recordCount", response.getRecords().size());
            result.put("totalSteps", total);
            result.put("records", records);
            call.resolve(result);
        } catch (Throwable error) {
            call.reject("レコードを読み取れませんでした: " + error.getMessage(), "READ_FAILED");
        }
    }

    /** Health Connect の設定画面（どのアプリが歩数を書いているか等）を開く */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Health Connect の設定画面を開けませんでした", "OPEN_FAILED");
        }
    }
}
