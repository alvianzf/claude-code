import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PublicRoute } from "./routes/PublicRoute";
import { RoleRoute } from "./routes/RoleRoute";
import { RoleRedirect } from "./routes/RoleRedirect";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TenantsAdminPage } from "./pages/TenantsAdminPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allow={["admin", "user"]} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>

            <Route element={<RoleRoute allow={["platform_admin"]} />}>
              <Route path="/admin/tenants" element={<TenantsAdminPage />} />
            </Route>
          </Route>

          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
