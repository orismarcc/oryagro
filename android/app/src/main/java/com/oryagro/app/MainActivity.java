package com.oryagro.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // O BridgeActivity chama setDecorFitsSystemWindows(false) por padrão,
        // fazendo o WebView desenhar sob a barra de status (causa o "pixelado"
        // e a sobreposição do horário/rede/bateria). Revertemos aqui para true:
        // o sistema reserva a área da status bar e o WebView começa abaixo dela.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
