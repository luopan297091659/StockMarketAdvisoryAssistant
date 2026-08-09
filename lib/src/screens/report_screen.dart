import 'package:flutter/material.dart';
import '../models.dart';

class ReportScreen extends StatelessWidget {
  const ReportScreen({super.key, required this.report});
  final ReportDetail report;
  @override
  Widget build(BuildContext context) {
    final body = report.report;
    final quality = body['dataQuality'] as Json? ?? const {};
    final symbol = body['symbol'] as String? ?? '--';
    final confidence = ((body['confidence'] as num?) ?? 0).toDouble();
    return Scaffold(
        appBar: AppBar(title: Text('$symbol 基础研究')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          Text('STRUCTURED REPORT · ${report.dataMode}',
              style: const TextStyle(
                  color: Color(0xFF0B6655), fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Card(
              child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(children: [
                    Expanded(
                        child: Text(symbol,
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(fontWeight: FontWeight.w800))),
                    Chip(
                        label: Text(
                            '${body['rating'] ?? 'NEUTRAL'} · ${(confidence * 100).round()}%'))
                  ]))),
          const SizedBox(height: 14),
          _Section(
              title: '研究概况',
              child: Text(
                  ((body['summary'] as Json?)?['text'] ?? '暂无摘要').toString(),
                  style: const TextStyle(height: 1.6))),
          const SizedBox(height: 14),
          _Section(
              title: '指标评分',
              child: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: (body['scores'] as Json? ?? const {})
                      .entries
                      .map((e) =>
                          Chip(label: Text('${e.key}: ${e.value ?? 'N/A'}')))
                      .toList())),
          const SizedBox(height: 14),
          _Section(
              title: '关键风险',
              child: _List(
                  items: body['keyRisks'] as List<dynamic>? ?? const [],
                  objectKey: 'text')),
          const SizedBox(height: 14),
          _Section(
              title: '数据限制',
              child: _List(
                  items: quality['limitations'] as List<dynamic>? ?? const [])),
          const SizedBox(height: 18),
          Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: const Color(0xFFFFF4D8),
                  borderRadius: BorderRadius.circular(14)),
              child:
                  Text(body['disclaimer'] as String? ?? '本报告仅供研究参考，不构成投资建议。')),
        ]));
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(
      child: Padding(
          padding: const EdgeInsets.all(18),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const Divider(height: 24),
            child
          ])));
}

class _List extends StatelessWidget {
  const _List({required this.items, this.objectKey});
  final List<dynamic> items;
  final String? objectKey;
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const Text('暂无');
    return Column(
        children: items.map((item) {
      final text = objectKey == null
          ? item.toString()
          : ((item as Json)[objectKey] ?? '').toString();
      return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.circle, size: 7),
            const SizedBox(width: 10),
            Expanded(child: Text(text))
          ]));
    }).toList());
  }
}
