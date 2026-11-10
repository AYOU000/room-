import type { RouteObject } from "react-router";
import { AppShell } from "../components/AppShell";
import { DebateRoomPage } from "../pages/DebateRoomPage";
import { DashboardPage } from "../pages/DashboardPage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "room/:sessionId", element: <DebateRoomPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
