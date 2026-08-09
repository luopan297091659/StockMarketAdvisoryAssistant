import 'dart:math';
import 'package:flutter/material.dart';
import '../api_client.dart';
import '../models.dart';
import '../session_controller.dart';
import 'report_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.session});
  final SessionController session;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _query = TextEditingController();
  List<Instrument> _results = const [];
  Watchlist? _watchlist;
  List<ReportSummary> _reports = const [];
  bool _loading = true;
  bool _searching = false;
  String? _message;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<Json> _auth(Future<Json> Function() call) =>
      widget.session.authorized(call);

  Future<void> _load() async {
    try {
      final lists = await _auth(() => widget.session.api.get('/watchlists'));
      final reports = await _auth(() => widget.session.api.get('/reports'));
      if (!mounted) return;
      final items = lists['items'] as List<dynamic>? ?? const [];
      setState(() {
        _watchlist =
            items.isEmpty ? null : Watchlist.fromJson(items.first as Json);
        _reports = (reports['items'] as List<dynamic>? ?? const [])
            .map((e) => ReportSummary.fromJson(e as Json))
            .toList();
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.message;
        });
      }
    }
  }

  Future<void> _search() async {
    if (_query.text.trim().isEmpty) return;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final payload = await _auth(() => widget.session.api.get(
          '/instruments/search?q=${Uri.encodeQueryComponent(_query.text.trim())}'));
      if (mounted) {
        setState(() => _results =
            (payload['items'] as List<dynamic>? ?? const [])
                .map((e) => Instrument.fromJson(e as Json))
                .toList());
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _add(Instrument instrument) async {
    if (_watchlist == null) return;
    try {
      await _auth(() => widget.session.api.post(
          '/watchlists/${_watchlist!.id}/items',
          {'instrument': instrument.raw}));
      if (mounted) {
        setState(() {
          _results = const [];
          _message = '${instrument.symbol} 已加入观察列表';
        });
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _research(Instrument instrument) async {
    setState(() {
      _message = '正在提交 ${instrument.symbol} 研究任务…';
      _error = null;
    });
    try {
      final key =
          '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}';
      final created = await _auth(() => widget.session.api.post(
          '/research-tasks', {'instrumentId': instrument.id, 'mode': 'BASIC'},
          headers: {'idempotency-key': key}));
      var task = ResearchTask.fromJson(created);
      for (var i = 0; i < 30; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 700));
        task = ResearchTask.fromJson(await _auth(
            () => widget.session.api.get('/research-tasks/${task.id}')));
        if (!mounted) return;
        setState(() => _message = task.status == 'ANALYZING'
            ? '正在构建快照并执行分析…'
            : '任务状态：${task.status}');
        if (task.status == 'SUCCEEDED' && task.reportId != null) {
          await _openReport(task.reportId!);
          await _load();
          return;
        }
        if (task.status == 'FAILED_FINAL') {
          throw ApiException(
              500, 'RESEARCH_FAILED', task.errorDetail ?? '研究任务失败');
        }
      }
      throw const ApiException(408, 'RESEARCH_TIMEOUT', '任务仍在运行，请稍后从报告历史查看');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _message = null;
        });
      }
    }
  }

  Future<void> _openReport(String id) async {
    try {
      final payload = await _auth(() => widget.session.api.get('/reports/$id'));
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) =>
              ReportScreen(report: ReportDetail.fromJson(payload))));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: const Row(children: [
              CircleAvatar(
                  radius: 18,
                  backgroundColor: Color(0xFF0B6655),
                  child: Text('EA',
                      style: TextStyle(color: Colors.white, fontSize: 12))),
              SizedBox(width: 10),
              Text('股宝AI', style: TextStyle(fontWeight: FontWeight.bold))
            ]),
            actions: [
              IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
              IconButton(
                  onPressed: widget.session.signOut,
                  icon: const Icon(Icons.logout))
            ]),
        body: RefreshIndicator(
            onRefresh: _load,
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    children: [
                        Text('你好，${widget.session.user?.displayName ?? ''}',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 6),
                        const Text('搜索标的，加入观察列表，然后生成可追溯的基础研究报告。'),
                        const SizedBox(height: 16),
                        Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                                color: const Color(0xFFFFF4D8),
                                borderRadius: BorderRadius.circular(14)),
                            child: const Row(children: [
                              Icon(Icons.shield_outlined),
                              SizedBox(width: 10),
                              Expanded(child: Text('当前仅提供合成数据；报告保持低置信度和中性评级。'))
                            ])),
                        const SizedBox(height: 16),
                        Card(
                            child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(children: [
                                  Row(children: [
                                    Expanded(
                                        child: TextField(
                                            controller: _query,
                                            onSubmitted: (_) => _search(),
                                            decoration: const InputDecoration(
                                                labelText: '搜索股票代码',
                                                hintText:
                                                    '7203.T、NVDA、600519'))),
                                    const SizedBox(width: 10),
                                    FilledButton(
                                        onPressed: _searching ? null : _search,
                                        child: _searching
                                            ? const SizedBox.square(
                                                dimension: 18,
                                                child:
                                                    CircularProgressIndicator(
                                                        strokeWidth: 2))
                                            : const Text('搜索'))
                                  ]),
                                  if (_results.isNotEmpty) ...[
                                    const Divider(height: 28),
                                    ..._results.map((e) => ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        title: Text('${e.symbol}  ${e.name}',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w700)),
                                        subtitle:
                                            Text('${e.market} · ${e.currency}'),
                                        trailing: OutlinedButton(
                                            onPressed: () => _add(e),
                                            child: const Text('加入观察'))))
                                  ],
                                ]))),
                        if (_message != null)
                          Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: Text(_message!,
                                  style: const TextStyle(
                                      color: Color(0xFF0B6655),
                                      fontWeight: FontWeight.w600))),
                        if (_error != null)
                          Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: Text(_error!,
                                  style: TextStyle(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .error))),
                        const SizedBox(height: 20),
                        _Header(
                            title: _watchlist?.name ?? '观察列表',
                            count: '${_watchlist?.items.length ?? 0} 个标的'),
                        const SizedBox(height: 10),
                        if (_watchlist?.items.isEmpty ?? true)
                          const Card(
                              child: Padding(
                                  padding: EdgeInsets.all(24),
                                  child: Text('先搜索并添加一个标的。')))
                        else
                          ..._watchlist!.items.map((item) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Card(
                                  child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Row(children: [
                                        CircleAvatar(
                                            child: Text(item.instrument.market
                                                .substring(
                                                    0,
                                                    min(
                                                        2,
                                                        item.instrument.market
                                                            .length)))),
                                        const SizedBox(width: 12),
                                        Expanded(
                                            child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                              Text(item.instrument.symbol,
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w800)),
                                              Text(item.instrument.name),
                                              Text(
                                                  '${item.instrument.currency} · ${item.instrument.timezone}',
                                                  style: const TextStyle(
                                                      fontSize: 11))
                                            ])),
                                        FilledButton.tonal(
                                            onPressed: () =>
                                                _research(item.instrument),
                                            child: const Text('生成研究'))
                                      ]))))),
                        const SizedBox(height: 20),
                        _Header(title: '研究报告', count: '${_reports.length} 份'),
                        const SizedBox(height: 10),
                        if (_reports.isEmpty)
                          const Card(
                              child: Padding(
                                  padding: EdgeInsets.all(24),
                                  child: Text('暂无报告')))
                        else
                          ..._reports.map((r) => Card(
                              child: ListTile(
                                  onTap: () => _openReport(r.id),
                                  leading: const Icon(Icons.article_outlined),
                                  title: Text(r.symbol),
                                  subtitle: Text(r.createdAt
                                      .toLocal()
                                      .toString()
                                      .substring(0, 16)),
                                  trailing: Chip(label: Text(r.rating))))),
                      ])),
      );
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.count});
  final String title;
  final String count;
  @override
  Widget build(BuildContext context) =>
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(title,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w800)),
        Text(count)
      ]);
}
