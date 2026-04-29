export function saveAuthUser(user: any) {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function getAuthUser() {
  const u = localStorage.getItem("auth_user");
  return u ? JSON.parse(u) : null;
}

export function logout() {
  localStorage.removeItem("auth_user");
  localStorage.removeItem("access_token");
}
