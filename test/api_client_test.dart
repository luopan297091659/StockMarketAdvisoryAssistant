import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gubao_ai/src/api_client.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('marks every API request as a native mobile client', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response(jsonEncode({'dataMode': 'REAL_MARKET_DATA'}), 200,
          headers: {'content-type': 'application/json'});
    });

    final api = ApiClient(
        baseUrl: 'https://api.example.com/api/v1', httpClient: client);
    await api.get('/config');

    expect(captured.headers['x-client-platform'], 'mobile');
    expect(captured.url.toString(), 'https://api.example.com/api/v1/config');
  });

  test('rejects non-JSON API responses with a customer-friendly error',
      () async {
    final api = ApiClient(
        baseUrl: 'https://api.example.com/api/v1',
        httpClient:
            MockClient((_) async => http.Response('gateway failure', 502)));
    expect(
        () => api.get('/config'),
        throwsA(isA<ApiException>()
            .having((error) => error.code, 'code', 'INVALID_API_RESPONSE')));
  });
}
