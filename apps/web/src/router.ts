import { createRouter, createWebHistory } from "vue-router";
import AuthView from "./views/AuthView.vue";
import DashboardView from "./views/DashboardView.vue";
import LegalView from "./views/LegalView.vue";
import { useSessionStore } from "./stores/session";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: AuthView },
    { path: "/", component: DashboardView, meta: { requiresAuth: true } },
    { path: "/legal/privacy", component: LegalView },
    { path: "/legal/terms", component: LegalView },
  ],
});

router.beforeEach(async (to) => {
  let authenticated = Boolean(sessionStorage.getItem("equity-atlas-access"));
  if (!authenticated && (to.meta.requiresAuth || to.path === "/login")) authenticated = await useSessionStore().resume();
  if (to.meta.requiresAuth && !authenticated) return "/login";
  if (to.path === "/login" && authenticated) return "/";
});
