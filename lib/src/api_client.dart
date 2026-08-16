import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

class ApiException implements Exception {
  const ApiException(this.status, this.code, this.message);
  final int status;
  final String code;
  final String message;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? httpClient})
      : _http = httpClient ?? http.Client();
  final String baseUrl;
  final http.Client _http;
  String? accessToken;
  Future<Json> get(String path) => _request('GET', path);
  Future<Json> post(String path, Json body, {Map<String, String>? headers}) =>
      _request('POST', path, body: body, extraHeaders: headers);
  Future<void> delete(String path) async => _request('DELETE', path);

  Future<Json> _request(String method, String path,
      {Json? body, Map<String, String>? extraHeaders}) async {
    final uri = Uri.parse('${baseUrl.replaceFirst(RegExp(r'/$'), '')}$path');
    final headers = <String, String>{
      'accept': 'application/json',
      'x-client-platform': 'mobile',
      if (body != null) 'content-type': 'application/json',
      if (accessToken != null) 'authorization': 'Bearer $accessToken',
      ...?extraHeaders
    };
    late http.Response response;
    try {
      response = await _http
          .send(http.Request(method, uri)
            ..headers.addAll(headers)
            ..body = body == null ? '' : jsonEncode(body))
          .then(http.Response.fromStream)
          .timeout(const Duration(seconds: 20));
    } catch (_) {
      throw const ApiException(0, 'NETWORK_ERROR', '无法连接服务，请检查网络与 API 地址');
    }
    if (response.statusCode == 204 || response.body.isEmpty) return const {};
    dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      throw ApiException(
          response.statusCode, 'INVALID_API_RESPONSE', '服务返回了无法识别的响应，请稍后重试');
    }
    final payload =
        decoded is Json ? decoded : <String, dynamic>{'data': decoded};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
          response.statusCode,
          payload['code'] as String? ?? 'API_ERROR',
          payload['message'] as String? ?? '请求失败');
    }
    return payload;
  }
}
