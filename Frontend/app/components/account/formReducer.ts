export type FormState = {
  loading: boolean;
  successMessage: string | null;
  errorMessage: string | null;
};

export type FormAction =
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_SUCCESS"; message: string }
  | { type: "SET_ERROR"; message: string }
  | { type: "CLEAR" };

export const initialFormState: FormState = {
  loading: false,
  successMessage: null,
  errorMessage: null,
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_SUCCESS":
      return { loading: false, successMessage: action.message, errorMessage: null };
    case "SET_ERROR":
      return { loading: false, successMessage: null, errorMessage: action.message };
    case "CLEAR":
      return initialFormState;
  }
}
