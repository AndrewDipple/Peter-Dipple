export type Role = "client" | "trainer" | "admin";

export const isStaff = (role: Role | string | null | undefined): boolean =>
  role === "trainer" || role === "admin";

export const isAdmin = (role: Role | string | null | undefined): boolean =>
  role === "admin";