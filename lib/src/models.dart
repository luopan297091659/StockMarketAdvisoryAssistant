typedef Json = Map<String, dynamic>;

class ProductConfig {
  const ProductConfig({required this.dataMode, required this.registrationMode});
  const ProductConfig.safeDefault()
      : dataMode = 'SYNTHETIC_DEMO',
        registrationMode = 'disabled';
  final String dataMode;
  final String registrationMode;
  bool get usesRealMarketData => dataMode == 'REAL_MARKET_DATA';
  bool get registrationEnabled => registrationMode != 'disabled';
  bool get inviteRequired => registrationMode == 'invite';
  factory ProductConfig.fromJson(Json json) => ProductConfig(
      dataMode: json['dataMode'] as String? ?? 'SYNTHETIC_DEMO',
      registrationMode: json['registrationMode'] as String? ?? 'disabled');
}

class UserProfile {
  const UserProfile(
      {required this.id, required this.email, required this.displayName});
  final String id;
  final String email;
  final String displayName;
  factory UserProfile.fromJson(Json json) => UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      displayName: json['displayName'] as String);
}

class Instrument {
  const Instrument(
      {required this.raw,
      required this.id,
      required this.symbol,
      required this.market,
      required this.currency,
      required this.timezone,
      required this.name});
  final Json raw;
  final String id;
  final String symbol;
  final String market;
  final String currency;
  final String timezone;
  final String name;
  factory Instrument.fromJson(Json json) {
    final names = (json['names'] as Json?) ?? const {};
    return Instrument(
      raw: json,
      id: json['instrumentId'] as String,
      symbol: json['displaySymbol'] as String? ?? '',
      market: json['market'] as String? ?? '',
      currency: json['currency'] as String? ?? '',
      timezone: json['timezone'] as String? ?? '',
      name:
          (names['zh-CN'] ?? names['ja-JP'] ?? names['en-US'] ?? '') as String,
    );
  }
}

class WatchlistItem {
  const WatchlistItem({required this.id, required this.instrument});
  final String id;
  final Instrument instrument;
  factory WatchlistItem.fromJson(Json json) => WatchlistItem(
      id: json['id'] as String,
      instrument: Instrument.fromJson(json['instrument'] as Json));
}

class Watchlist {
  const Watchlist({required this.id, required this.name, required this.items});
  final String id;
  final String name;
  final List<WatchlistItem> items;
  factory Watchlist.fromJson(Json json) => Watchlist(
        id: json['id'] as String,
        name: json['name'] as String,
        items: (json['items'] as List<dynamic>? ?? const [])
            .map((item) => WatchlistItem.fromJson(item as Json))
            .toList(),
      );
}

class ResearchTask {
  const ResearchTask(
      {required this.id,
      required this.status,
      this.reportId,
      this.errorDetail});
  final String id;
  final String status;
  final String? reportId;
  final String? errorDetail;
  factory ResearchTask.fromJson(Json json) => ResearchTask(
      id: json['id'] as String,
      status: json['status'] as String,
      reportId: json['reportId'] as String?,
      errorDetail: json['errorDetail'] as String?);
}

class ReportSummary {
  const ReportSummary(
      {required this.id,
      required this.symbol,
      required this.rating,
      required this.createdAt});
  final String id;
  final String symbol;
  final String rating;
  final DateTime createdAt;
  factory ReportSummary.fromJson(Json json) {
    final report = json['report'] as Json? ?? const {};
    return ReportSummary(
        id: json['id'] as String,
        symbol: report['symbol'] as String? ?? '--',
        rating: report['rating'] as String? ?? 'NEUTRAL',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now());
  }
}

class ReportDetail {
  const ReportDetail(
      {required this.id,
      required this.dataMode,
      required this.report,
      required this.snapshot});
  final String id;
  final String dataMode;
  final Json report;
  final Json snapshot;
  bool get usesRealMarketData => dataMode == 'REAL_MARKET_DATA';
  Json get quote => snapshot['quote'] as Json? ?? const {};
  Json get lastQuote => quote['last'] as Json? ?? const {};
  Json get dataQuality =>
      snapshot['dataQuality'] as Json? ??
      report['dataQuality'] as Json? ??
      const {};
  List<Json> get sources => (snapshot['sources'] as List<dynamic>? ?? const [])
      .whereType<Json>()
      .toList();
  factory ReportDetail.fromJson(Json json) => ReportDetail(
      id: json['id'] as String,
      dataMode: json['dataMode'] as String? ?? '',
      report: json['report'] as Json? ?? const {},
      snapshot: json['snapshot'] as Json? ?? const {});
}
