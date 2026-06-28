const DASHBOARD_ACCESS_TOKEN_KEY = "acme-dashboard-access-token";

export function readDashboardAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(DASHBOARD_ACCESS_TOKEN_KEY);
  return value && value.length > 0 ? value : null;
}

export function storeDashboardAccessToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DASHBOARD_ACCESS_TOKEN_KEY, token);
}

export function clearDashboardAccessToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DASHBOARD_ACCESS_TOKEN_KEY);
}
