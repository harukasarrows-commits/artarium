# Vendor Runtime

完全オフラインでGLB表示を行う場合は、Three.jsのESMファイルをここに配置します。

想定ファイル:

- `three.module.js`
- `GLTFLoader.js`

未配置の場合、アプリはCDNのThree.jsを試し、失敗した場合は展示室を仮画像で表示します。
