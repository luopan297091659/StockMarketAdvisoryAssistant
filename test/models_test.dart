import 'package:gubao_ai/src/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('instrument prefers Chinese display name', () {
    final instrument = Instrument.fromJson({
      'instrumentId': 'JP-XTKS-7203',
      'displaySymbol': '7203.T',
      'market': 'JP',
      'currency': 'JPY',
      'timezone': 'Asia/Tokyo',
      'names': {'en-US': 'Toyota', 'zh-CN': '丰田汽车'}
    });
    expect(instrument.name, '丰田汽车');
    expect(instrument.timezone, 'Asia/Tokyo');
  });
  test('report summary tolerates incomplete API data', () {
    final report = ReportSummary.fromJson({
      'id': 'report-1',
      'createdAt': '2026-08-09T10:00:00Z',
      'report': {'symbol': 'NVDA'}
    });
    expect(report.symbol, 'NVDA');
    expect(report.rating, 'NEUTRAL');
  });
}
