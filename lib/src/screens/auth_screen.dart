import 'package:flutter/material.dart';
import '../session_controller.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.session});
  final SessionController session;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _key = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _inviteCode = TextEditingController();
  bool _register = false;
  bool _obscure = true;
  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    _inviteCode.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_key.currentState!.validate()) return;
    await widget.session.authenticate(
        register: _register,
        email: _email.text,
        password: _password.text,
        displayName: _name.text,
        inviteCode: _inviteCode.text);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
            child: Center(
                child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CircleAvatar(
                                      radius: 25,
                                      backgroundColor: Color(0xFF0B6655),
                                      child: Text('EA',
                                          style: TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w800))),
                                  SizedBox(width: 12),
                                  Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text('股宝AI',
                                            style: TextStyle(
                                                fontSize: 22,
                                                fontWeight: FontWeight.w800)),
                                        Text('GubaoAI',
                                            style: TextStyle(
                                                letterSpacing: 2, fontSize: 11))
                                      ]),
                                ]),
                            const SizedBox(height: 32),
                            Card(
                                child: Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: Form(
                                        key: _key,
                                        child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.stretch,
                                            children: [
                                              Text(
                                                  _register ? '创建研究账户' : '欢迎回来',
                                                  style: Theme.of(context)
                                                      .textTheme
                                                      .headlineSmall
                                                      ?.copyWith(
                                                          fontWeight:
                                                              FontWeight.w700)),
                                              const SizedBox(height: 20),
                                              if (_register) ...[
                                                TextFormField(
                                                    controller: _name,
                                                    textInputAction:
                                                        TextInputAction.next,
                                                    decoration:
                                                        const InputDecoration(
                                                            labelText: '显示名称',
                                                            prefixIcon: Icon(Icons
                                                                .person_outline)),
                                                    validator: (v) =>
                                                        (v?.trim().isEmpty ??
                                                                true)
                                                            ? '请输入显示名称'
                                                            : null),
                                                const SizedBox(height: 14),
                                                if (widget.session.config
                                                    .inviteRequired) ...[
                                                  TextFormField(
                                                      controller: _inviteCode,
                                                      textInputAction:
                                                          TextInputAction.next,
                                                      decoration:
                                                          const InputDecoration(
                                                              labelText: '邀请码',
                                                              prefixIcon: Icon(Icons
                                                                  .key_outlined)),
                                                      validator: (v) =>
                                                          (v?.trim().isEmpty ??
                                                                  true)
                                                              ? '请输入客户邀请码'
                                                              : null),
                                                  const SizedBox(height: 14),
                                                ],
                                              ],
                                              TextFormField(
                                                  controller: _email,
                                                  keyboardType: TextInputType
                                                      .emailAddress,
                                                  textInputAction:
                                                      TextInputAction.next,
                                                  decoration:
                                                      const InputDecoration(
                                                          labelText: '邮箱',
                                                          prefixIcon: Icon(Icons
                                                              .mail_outline)),
                                                  validator: (v) =>
                                                      !(v?.contains('@') ??
                                                              false)
                                                          ? '请输入有效邮箱'
                                                          : null),
                                              const SizedBox(height: 14),
                                              TextFormField(
                                                  controller: _password,
                                                  obscureText: _obscure,
                                                  onFieldSubmitted: (_) =>
                                                      _submit(),
                                                  decoration: InputDecoration(
                                                      labelText: '密码',
                                                      prefixIcon: const Icon(
                                                          Icons.lock_outline),
                                                      suffixIcon: IconButton(
                                                          onPressed: () =>
                                                              setState(() =>
                                                                  _obscure =
                                                                      !_obscure),
                                                          icon: Icon(_obscure
                                                              ? Icons
                                                                  .visibility_outlined
                                                              : Icons
                                                                  .visibility_off_outlined))),
                                                  validator: (v) =>
                                                      (v?.length ?? 0) < 10
                                                          ? '密码至少 10 位'
                                                          : null),
                                              if (widget.session.error !=
                                                  null) ...[
                                                const SizedBox(height: 12),
                                                Text(widget.session.error!,
                                                    style: TextStyle(
                                                        color: Theme.of(context)
                                                            .colorScheme
                                                            .error))
                                              ],
                                              const SizedBox(height: 20),
                                              FilledButton(
                                                  onPressed: widget.session.busy
                                                      ? null
                                                      : _submit,
                                                  child: Padding(
                                                      padding: const EdgeInsets
                                                          .symmetric(
                                                          vertical: 13),
                                                      child: widget.session.busy
                                                          ? const SizedBox
                                                              .square(
                                                              dimension: 20,
                                                              child:
                                                                  CircularProgressIndicator(
                                                                      strokeWidth:
                                                                          2))
                                                          : Text(_register
                                                              ? '注册并进入'
                                                              : '登录'))),
                                              if (widget.session.config
                                                  .registrationEnabled)
                                                TextButton(
                                                    onPressed: widget
                                                            .session.busy
                                                        ? null
                                                        : () => setState(() =>
                                                            _register =
                                                                !_register),
                                                    child: Text(_register
                                                        ? '已有账户？直接登录'
                                                        : '没有账户？立即注册')),
                                            ])))),
                            const SizedBox(height: 18),
                            Text(
                                widget.session.config.usesRealMarketData
                                    ? '已连接真实供应商行情；数据可能延迟且仅供研究参考，不构成投资建议。'
                                    : widget.session.configAvailable
                                        ? '当前为合成数据演示环境，不可用于真实投资决策。'
                                        : '尚未连接服务配置，请检查网络与 API 地址。',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12)),
                          ]),
                    )))),
      );
}
