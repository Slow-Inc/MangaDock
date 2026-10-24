"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class CommunityErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-4 py-20 text-ink-2">
          <p className="text-lg">เกิดข้อผิดพลาด</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-fill px-4 py-2 text-sm hover:bg-raised"
          >
            โหลดใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
