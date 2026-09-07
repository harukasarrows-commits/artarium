package com.arrows.artarium;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Android の歩数センサー（TYPE_STEP_COUNTER）を読むための最小プラグイン。
 *
 * センサーが返すのは「端末を起動してからの累計歩数」。
 * ただし Samsung 端末（Galaxy S10 で実測。2026-09-07）では、どこかのアプリがセンサーを
 * 登録している間しかカウントが進まない（3日間の稼働で 0 のままだった）。
 * そのため、このプラグインは許可が取れ次第センサーを登録しっぱなしにし、
 * アプリのプロセスが生きている間（前面・背面とも）はカウントが進むようにする。
 * プロセスが終了している間の歩数は数えられない（常駐サービスが必要。roadmap 参照）。
 *
 * 「今日の歩数」への換算（基準値の管理）は JS 側 core/native-step-counter.js が行う。
 * JS からの呼び出し: window.Capacitor.nativePromise("StepCounter", "<メソッド名>", {})
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = { @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }) }
)
public class StepCounterPlugin extends Plugin {

    // 登録直後の初回イベントは端末によって遅れる（Android の仕様上は最大 10 秒）。
    // 届かなくても常駐リスナーが値を受け取った時点で JS に知らせるので、ここでは待ちすぎない
    private static final long READ_TIMEOUT_MS = 10000;
    // 歩数が変わるたびに JS へ知らせて画面を更新したいので、まとめ配信（batching）はしない。
    // 非ウェイクアップセンサーなので端末を起こすことはなく、歩数の変化時しかイベントは来ない
    private static final int MAX_REPORT_LATENCY_US = 0;

    private Long latestCumulative = null;
    private SensorEventListener persistentListener = null;

    private SensorManager sensorManager() {
        return (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    }

    private Sensor stepSensor() {
        SensorManager manager = sensorManager();
        return manager == null ? null : manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    }

    // ACTIVITY_RECOGNITION は Android 10 (API 29) 以降だけ実行時の許可が必要
    private boolean hasPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return getPermissionState("activity") == PermissionState.GRANTED;
    }

    @Override
    public void load() {
        super.load();
        startCounting();
    }

    /** 許可済みならセンサーを登録し、カウントを進め続ける（多重登録はしない） */
    private void startCounting() {
        if (persistentListener != null || !hasPermission()) return;
        final Sensor sensor = stepSensor();
        final SensorManager manager = sensorManager();
        if (sensor == null || manager == null) return;
        SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                long next = (long) Math.round(event.values[0]);
                boolean changed = latestCumulative == null || latestCumulative != next;
                latestCumulative = next;
                // 歩数が進んだら JS に知らせる（前面表示中でも画面の歩数が追随するように）
                if (changed) notifyStepsChanged();
            }

            @Override
            public void onAccuracyChanged(Sensor changedSensor, int accuracy) {}
        };
        if (manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, MAX_REPORT_LATENCY_US)) {
            persistentListener = listener;
        }
    }

    @Override
    protected void handleOnDestroy() {
        SensorManager manager = sensorManager();
        if (persistentListener != null && manager != null) {
            manager.unregisterListener(persistentListener);
            persistentListener = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", stepSensor() != null);
        result.put("permission", hasPermission() ? "granted" : "prompt");
        result.put("counting", persistentListener != null);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasPermission()) {
            resolvePermission(call);
            return;
        }
        requestPermissionForAlias("activity", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        resolvePermission(call);
    }

    private void resolvePermission(PluginCall call) {
        startCounting();
        JSObject result = new JSObject();
        result.put("activity", hasPermission() ? "granted" : "denied");
        call.resolve(result);
    }

    private JSObject cumulativeResult(long cumulative) {
        JSObject result = new JSObject();
        result.put("cumulativeSteps", cumulative);
        result.put("readAt", System.currentTimeMillis());
        return result;
    }

    /** 起動後の累計歩数を返す。常駐リスナーが値を持っていればそれを、無ければ1回だけ読みに行く。 */
    @PluginMethod
    public void getCumulativeSteps(PluginCall call) {
        final Sensor sensor = stepSensor();
        if (sensor == null) {
            call.reject("歩数センサーがこの端末にありません", "UNAVAILABLE");
            return;
        }
        if (!hasPermission()) {
            call.reject("歩数センサーの権限がありません", "PERMISSION_DENIED");
            return;
        }
        startCounting();
        if (latestCumulative != null) {
            call.resolve(cumulativeResult(latestCumulative));
            return;
        }

        final SensorManager manager = sensorManager();
        final Handler handler = new Handler(Looper.getMainLooper());
        final boolean[] done = { false };
        final SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (done[0]) return;
                done[0] = true;
                manager.unregisterListener(this);
                long cumulative = Math.round(event.values[0]);
                latestCumulative = cumulative;
                call.resolve(cumulativeResult(cumulative));
            }

            @Override
            public void onAccuracyChanged(Sensor changedSensor, int accuracy) {}
        };
        if (!manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)) {
            call.reject("歩数センサーを開始できませんでした", "REGISTER_FAILED");
            return;
        }
        handler.postDelayed(() -> {
            if (done[0]) return;
            done[0] = true;
            manager.unregisterListener(listener);
            call.reject("歩数センサーから値が届きませんでした", "TIMEOUT");
        }, READ_TIMEOUT_MS);
    }

    /** JS へ素の DOM イベントとして知らせる（window.Capacitor が未初期化の起動直後でも失敗しない） */
    private void dispatchWindowEvent(String name) {
        if (getBridge() == null) return;
        getBridge().eval("window.dispatchEvent(new Event('" + name + "'))", null);
    }

    private void notifyStepsChanged() {
        dispatchWindowEvent("artariumNativeStepsChanged");
    }

    /** アプリが前面に戻ったら JS 側へ知らせ、背面にいた間の歩数を取り込ませる */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        dispatchWindowEvent("artariumNativeResume");
    }
}
