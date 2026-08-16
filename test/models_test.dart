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
  test('product config exposes customer data and registration modes', () {
    final config = ProductConfig.fromJson(
        {'dataMode': 'REAL_MARKET_DATA', 'registrationMode': 'invite'});
    expect(config.usesRealMarketData, isTrue);
    expect(config.inviteRequired, isTrue);
    expect(config.registrationEnabled, isTrue);
  });

  test('report detail exposes quote provenance and quality', () {
    final detail = ReportDetail.fromJson({
      'id': 'report-real',
      'dataMode': 'REAL_MARKET_DATA',
      'report': <String, dynamic>{},
      'snapshot': {
        'quote': {
          'currency': 'USD',
          'last': {'value': 212.5, 'provider': 'Twelve Data'}
        },
        'dataQuality': {'level': 'MEDIUM', 'score': 60},
        'sources': [
          {'provider': 'Twelve Data', 'title': 'Daily bars'}
        ]
      }
    });
    expect(detail.usesRealMarketData, isTrue);
    expect(detail.lastQuote['value'], 212.5);
    expect(detail.dataQuality['score'], 60);
    expect(detail.sources.single['provider'], 'Twelve Data');
  });
}
