import 'package:flutter/material.dart';

import 'src/api_client.dart';
import 'src/app.dart';
import 'src/session_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  const apiBase = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );
  runApp(GubaoAIApp(
    session: SessionController(ApiClient(baseUrl: apiBase)),
  ));
}
