export type SupabaseAuthUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  providers: string[];
};
