import 'package:flutter/material.dart';
import 'screens/auth_screen.dart';
import 'screens/dashboard_screen.dart';
import 'session_controller.dart';

class GubaoAIApp extends StatefulWidget {
  const GubaoAIApp({super.key, required this.session});
  final SessionController session;
  @override
  State<GubaoAIApp> createState() => _GubaoAIAppState();
}

class _GubaoAIAppState extends State<GubaoAIApp> {
  @override
  void initState() {
    super.initState();
    widget.session.restore();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'GubaoAI · 股宝AI',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B6655)),
          scaffoldBackgroundColor: const Color(0xFFF4F7F5),
          cardTheme: const CardTheme(
              elevation: 0,
              margin: EdgeInsets.zero,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.all(Radius.circular(20)),
                  side: BorderSide(color: Color(0xFFE0E8E4)))),
          inputDecorationTheme: const InputDecorationTheme(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(14)))),
        ),
        home: ListenableBuilder(
          listenable: widget.session,
          builder: (_, __) {
            if (!widget.session.initialized) {
              return const Scaffold(
                  body: Center(child: CircularProgressIndicator()));
            }
            return widget.session.isAuthenticated
                ? DashboardScreen(session: widget.session)
                : AuthScreen(session: widget.session);
          },
        ),
      );
}
