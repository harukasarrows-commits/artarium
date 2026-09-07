package com.arrows.artarium;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

/**
 * Health Connect の許可画面から「このアプリがなぜ歩数を読むのか」を確認したときに開く説明画面。
 * Health Connect 側の決まりで、読み取りを求めるアプリはこの画面を用意する必要がある。
 */
public class PermissionsRationaleActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView text = new TextView(this);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        text.setPadding(padding, padding, padding, padding);
        text.setTextSize(16);
        text.setText(
            "Artarium は、あなたの歩数で植物を育てるアプリです。\n\n" +
            "Health Connect から「歩数」だけを読み取り、今日と直近7日間の歩数を植物の成長に反映します。\n\n" +
            "読み取った歩数はこの端末の中だけで使い、外部に送信することはありません。"
        );
        setContentView(text);
    }
}
