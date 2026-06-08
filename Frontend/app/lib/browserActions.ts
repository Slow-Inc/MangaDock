export function reloadPage(): void {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export function redirectToHome(): void {
  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
}
