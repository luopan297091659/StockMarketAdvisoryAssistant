import { createRouter, createWebHistory } from "vue-router";
import AuthView from "./views/AuthView.vue";
import DashboardView from "./views/DashboardView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: AuthView },
    { path: "/", component: DashboardView, meta: { requiresAuth: true } },
  ],
});

router.beforeEach((to) => {
  const authenticated = Boolean(localStorage.getItem("equity-atlas-access"));
  if (to.meta.requiresAuth && !authenticated) return "/login";
  if (to.path === "/login" && authenticated) return "/";
});

