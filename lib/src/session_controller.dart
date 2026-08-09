import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';
import 'models.dart';

class SessionController extends ChangeNotifier {
  SessionController(this.api, {FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();
  final ApiClient api;
  final FlutterSecureStorage _storage;
  UserProfile? user;
  String? _refreshToken;
  bool initialized = false;
  bool busy = false;
  String? error;
  bool get isAuthenticated => user != null && api.accessToken != null;

  Future<void> restore() async {
    api.accessToken = await _storage.read(key: 'access_token');
    _refreshToken = await _storage.read(key: 'refresh_token');
    final id = await _storage.read(key: 'user_id');
    final email = await _storage.read(key: 'user_email');
    final name = await _storage.read(key: 'user_name');
    if (id != null && email != null && name != null) {
      user = UserProfile(id: id, email: email, displayName: name);
    }
    if (api.accessToken == null && _refreshToken != null) await refresh();
    initialized = true;
    notifyListeners();
  }

  Future<bool> authenticate(
      {required bool register,
      required String email,
      required String password,
      String? displayName}) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final payload =
          await api.post('/auth/${register ? 'register' : 'login'}', {
        'email': email.trim(),
        'password': password,
        if (register) 'displayName': displayName?.trim() ?? ''
      });
      await _saveAuth(payload);
      return true;
    } on ApiException catch (exception) {
      error = exception.message;
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> refresh() async {
    if (_refreshToken == null) return false;
    try {
      final payload =
          await api.post('/auth/refresh', {'refreshToken': _refreshToken});
      await _saveAuth(payload, keepExistingUser: true);
      return true;
    } catch (_) {
      await signOut();
      return false;
    }
  }

  Future<Json> authorized(Future<Json> Function() request) async {
    try {
      return await request();
    } on ApiException catch (exception) {
      if (exception.status == 401 && await refresh()) return request();
      rethrow;
    }
  }

  Future<void> _saveAuth(Json payload, {bool keepExistingUser = false}) async {
    api.accessToken = payload['accessToken'] as String;
    _refreshToken = payload['refreshToken'] as String;
    if (!keepExistingUser || user == null) {
      user = UserProfile.fromJson(payload['user'] as Json);
    }
    await Future.wait([
      _storage.write(key: 'access_token', value: api.accessToken),
      _storage.write(key: 'refresh_token', value: _refreshToken),
      _storage.write(key: 'user_id', value: user!.id),
      _storage.write(key: 'user_email', value: user!.email),
      _storage.write(key: 'user_name', value: user!.displayName),
    ]);
  }

  Future<void> signOut() async {
    api.accessToken = null;
    _refreshToken = null;
    user = null;
    await _storage.deleteAll();
    notifyListeners();
  }
}
