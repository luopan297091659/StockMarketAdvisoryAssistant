import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

import 'src/api_client.dart';
import 'src/app.dart';
import 'src/session_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  const apiBase = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );
  const allowInsecureApi = bool.fromEnvironment('ALLOW_INSECURE_API');
  final apiUri = Uri.tryParse(apiBase);
  if (apiUri == null || !apiUri.hasScheme || apiUri.host.isEmpty) {
    throw StateError('API_BASE_URL 必须是完整的 API 地址');
  }
  if (kReleaseMode && apiUri.scheme != 'https' && !allowInsecureApi) {
    throw StateError('正式版仅允许 HTTPS API；本地测试可显式设置 ALLOW_INSECURE_API=true');
  }
  runApp(GubaoAIApp(
    session: SessionController(ApiClient(baseUrl: apiBase)),
  ));
}
