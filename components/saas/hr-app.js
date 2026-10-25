"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  AccountProfile,
  AccountProfileSkeleton,
} from "@/components/saas/account-profile";
import { EmployeeProfile } from "@/components/saas/employee-profile";
import {
  RecordDetails,
  DetailNotFound,
} from "@/components/saas/record-details";
import { DEMO_CREDENTIALS } from "@/lib/demo-credentials";
import {
  PAGE_PATHS,
  RESOURCE_PAGES,
  RESOURCE_MODAL,
  profilePath,
  recordPath,
  workspaceRoute,
} from "@/lib/navigation";
import { useEffect, useState } from "react";
import { signIn, signOut, getSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock3,
  BriefcaseBusiness,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Ellipsis,
  Sun,
  Moon,
  HelpCircle,
  ArrowRight,
  Download,
  Filter,
  Check,
  X,
  LogOut,
  Menu,
  Heart,
  Globe,
  Mail,
  MapPin,
  FileText,
  CheckCheck,
  ExternalLink,
  Building2,
  TrendingUp,
  SlidersHorizontal,
  ShieldCheck,
  RefreshCw,
  QrCode,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  demoData,
  demoUsers,
  demoWorkspace,
  roleNames,
  scopeDemoData,
  availablePages,
  mergeDemoData,
  buildDemoNotification,
  localRecordCode,
} from "@/lib/demo";
import {
  LoginScreen,
  DashboardSkeleton,
  RoleDashboard,
  WorkforceInsights,
  AnimatedCard,
  TeamGrowth,
} from "@/components/saas";
import {
  CompliancePanel,
  CompensationPanel,
  WorkspacePanel,
} from "@/components/saas/workflows";
import {
  AnnouncementsPanel,
  SettingsPanel,
} from "@/components/saas/organization";
import { WorkspaceSetup } from "@/components/saas/workspace-setup";
import { PhotoUploader } from "@/components/saas/photo-uploader";
import {
  NotificationBell,
  useLiveNotifications,
} from "@/components/saas/notifications";
import {
  usePreferences,
  LanguageSwitcher,
  AppearancePreferences,
} from "@/components/saas/preferences";
import { ProfilePass, ProfileScanner } from "@/components/saas/profile-pass";
import { CredentialForm } from "@/components/saas/credential-form";
import { ExportOptions } from "@/components/saas/export-dialog";
import { PageSkeleton } from "@/components/saas/dashboard-skeleton";
import { Spotlight } from "@/components/ui/spotlight";
import BlurText from "@/components/ui/blur-text";
const nav = [
  ["Overview", LayoutDashboard],
  ["Employees", Users],
  ["Time off", CalendarDays],
  ["Recruitment", BriefcaseBusiness],
  ["Payroll", Wallet],
  ["Compensation", Wallet],
  ["Compliance", ShieldCheck],
  ["Performance", ChartNoAxesCombined],
];
const departments = [
  "Engineering",
  "Design",
  "Marketing",
  "People & HR",
  "Sales",
  "Finance",
];
const initials = (n) =>
  n
    ?.split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2) || "HR";
function Avatar({ name, color = "peach", small = false, photoUrl }) {
  const { t } = usePreferences();
  return (
    <span className={`avatar ${color} ${small ? "small" : ""}`}>
      {photoUrl ? (
        <img src={photoUrl} alt={`${name} profile photo`} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
function Badge({ children }) {
  const { t } = usePreferences();
  return (
    <span
      className={`badge ${["Approved", "Full-time", "Completed", "Present", "Open", "Paid"].includes(children) ? "positive" : ["Pending", "In progress", "On leave"].includes(children) ? "warning" : "neutral"}`}
    >
      <i />
      {t(children)}
    </span>
  );
}
function AnimatedNumber({ value }) {
  const { t } = usePreferences();
  return (
    <motion.span
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      key={value}
    >
      {value}
    </motion.span>
  );
}
export default function HRApp({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const route = workspaceRoute(pathname);
  const page = route?.page || "Overview";
  const profileId = route?.profileId || null;
  const detailResource = route?.resource || null;
  const recordId = route?.recordId || null;
  const selfProfile = !!route?.selfProfile;
  const isDetail = !!profileId || !!recordId || selfProfile;
  const skeletonPage =
    profileId || selfProfile
      ? "Employee profile"
      : recordId
        ? "Record details"
        : page;
  const [detailState, setDetailState] = useState({
    path: "",
    payload: null,
    error: "",
  });
  const routePath = route?.path || pathname;
  const detail = detailState.path === routePath ? detailState.payload : null;
  const { t, locale } = usePreferences();
  const [records, setRecords] = useState(demoData),
    [demoRole, setDemoRole] = useState(null),
    [authReady, setAuthReady] = useState(false),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [workspace, setWorkspace] = useState(demoWorkspace),
    [saving, setSaving] = useState(false),
    [signingIn, setSigningIn] = useState(false),
    [dark, setDark] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All departments"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [notifications, setNotifications] = useState(false),
    [mobile, setMobile] = useState(false),
    [session, setSession] = useState(null),
    [config, setConfig] = useState({}),
    [ready, setReady] = useState(false),
    [period, setPeriod] = useState("This year"),
    [chartMode, setChartMode] = useState("Headcount"),
    [viewAll, setViewAll] = useState(false),
    [settings, setSettings] = useState({
      company: "Acme Studio",
      week: "Monday",
      email: true,
    });
  useEffect(() => {
    let restoredDemoRole = null;
    try {
      const saved = localStorage.getItem("peopleos-v1");
      if (saved) setRecords(mergeDemoData(JSON.parse(saved)));
      const savedTheme = localStorage.getItem("peopleos-theme");
      setDark(
        savedTheme
          ? savedTheme === "dark"
          : window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
      const prefs = localStorage.getItem("peopleos-settings");
      if (prefs) setSettings(JSON.parse(prefs));
      const role = sessionStorage.getItem("peopleos-demo-role");
      if (demoUsers[role]) restoredDemoRole = role;
    } catch {}
    setReady(true);
    Promise.all([
      fetch("/api/config").then((r) => r.json()),
      getSession(),
      fetch("/api/demo", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(async ([cfg, sess, preview]) => {
        setConfig({ ...cfg, demoEnabled: preview.enabled === true });
        setSession(sess);
        if (sess) {
          setRecords(
            Object.fromEntries(Object.keys(demoData).map((k) => [k, []])),
          );
          if (["admin", "hr", "employee"].includes(sess.user.role))
            setLoading(true);
        } else if (preview.enabled) {
          let role = demoUsers[preview.role] ? preview.role : restoredDemoRole;
          if (role && !preview.role) {
            const response = await fetch("/api/demo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role }),
            });
            if (!response.ok) role = null;
          }
          if (role) {
            setDemoRole(role);
            sessionStorage.setItem("peopleos-demo-role", role);
          }
        } else sessionStorage.removeItem("peopleos-demo-role");
      })
      .catch(() =>
        setLoadError("Unable to check your session. Reload to try again."),
      )
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (ready && demoRole && !session)
      try {
        localStorage.setItem("peopleos-v1", JSON.stringify(records));
      } catch {}
  }, [records, ready, demoRole, session]);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("peopleos-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const cloud = !!session;
  const user =
    (session?.user &&
    (["admin", "hr", "employee"].includes(session.user.role) ||
      session.user.verifiedGoogle === true)
      ? session.user
      : null) ||
    (!session && demoRole
      ? {
          ...demoUsers[demoRole],
          memberCode: records.memberships.find(
            (m) => m.email === demoUsers[demoRole].email,
          )?.memberCode,
          workspaceId: demoWorkspace.id,
          workspaceName: demoWorkspace.name,
        }
      : null);
  const isAdmin = user?.role === "admin" || user?.role === "hr";
  const isOwner = user?.role === "admin";
  const data = cloud ? records : scopeDemoData(records, user);
  const pages = availablePages(user?.role);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!session || !["admin", "hr", "employee"].includes(session.user.role))
      return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setRecords(Object.fromEntries(Object.keys(demoData).map((k) => [k, []])));
    if (!config.database) {
      setLoadError("MongoDB must be configured to load a signed-in workspace.");
      setLoading(false);
      return;
    }
    const role = session.user.role;
    const resources = Object.keys(demoData)
      .filter((k) => k !== "notifications")
      .filter(
        (k) =>
          role === "admin" ||
          (role === "hr" && k !== "memberships") ||
          (role === "employee" &&
            !["compliance", "memberships", "audit"].includes(k)),
      );
    Promise.all([
      Promise.all(
        resources.map(async (resource) => {
          const response = await fetch(`/api/${resource}`);
          const result = await response.json();
          if (!response.ok)
            throw Error(result.error || "Workspace data could not be loaded");
          return [resource, result];
        }),
      ),
      fetch("/api/workspace").then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw Error(result.error || "Workspace is unavailable");
        return result;
      }),
    ])
      .then(([rows, ws]) => {
        if (cancelled) return;
        setRecords({
          ...Object.fromEntries(Object.keys(demoData).map((k) => [k, []])),
          ...Object.fromEntries(rows),
        });
        setWorkspace({
          id: ws.id || ws.workspaceId,
          name: ws.name || session.user.workspaceName,
          plan: ws.plan || "Trial",
        });
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, config.database, refreshKey]);
  useEffect(() => {
    if (
      !session ||
      !config.database ||
      !["admin", "hr", "employee"].includes(session.user.role) ||
      !isDetail
    )
      return;
    const controller = new AbortController();
    setDetailState({ path: routePath, payload: null, error: "" });
    const endpoint = selfProfile
      ? "/api/profile"
      : profileId
        ? `/api/employees/${encodeURIComponent(profileId)}`
        : `/api/${encodeURIComponent(detailResource)}/${encodeURIComponent(recordId)}`;
    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          if ([403, 404].includes(response.status)) return null;
          throw Error(payload.error || "Record could not be loaded");
        }
        return payload;
      })
      .then((payload) => {
        if (!controller.signal.aborted)
          setDetailState({
            path: routePath,
            payload,
            error: "",
            complete: true,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDetailState({
            path: routePath,
            payload: null,
            error: error.message,
            complete: true,
          });
      });
    return () => controller.abort();
  }, [
    session,
    config.database,
    routePath,
    profileId,
    detailResource,
    recordId,
    selfProfile,
    refreshKey,
  ]);
  useEffect(() => {
    setSearch("");
    setFilter("All departments");
    setMobile(false);
    setModal(null);
    if (new URLSearchParams(window.location.search).get("access") === "denied")
      setToast("You do not have access to that page or record.");
  }, [pathname]);
  useEffect(() => {
    if (!demoRole || session) return;
    function sync(event) {
      if (event.key === "peopleos-v1" && event.newValue)
        try {
          setRecords(mergeDemoData(JSON.parse(event.newValue)));
        } catch {}
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [demoRole, session]);
  function markDemoRead(id) {
    setRecords((d) => ({
      ...d,
      notifications: d.notifications.map((item) =>
        id === "all" || item.id === id
          ? {
              ...item,
              readBy: [...new Set([...(item.readBy || []), user.email])],
            }
          : item,
      ),
    }));
  }
  useEffect(() => {
    if (
      !ready ||
      !authReady ||
      pathname !== "/" ||
      !["admin", "hr", "employee"].includes(user?.role)
    )
      return;
    let cancelled = false;
    if (cloud) router.replace(requestedDestination());
    else
      fetch("/api/demo", { cache: "no-store" })
        .then((r) => r.json())
        .then((preview) => {
          if (cancelled) return;
          if (preview.enabled && demoUsers[preview.role]) {
            setDemoRole(preview.role);
            router.replace(requestedDestination());
          } else {
            setDemoRole(null);
            sessionStorage.removeItem("peopleos-demo-role");
          }
        })
        .catch(() => {
          if (!cancelled) setDemoRole(null);
        });
    return () => {
      cancelled = true;
    };
  }, [ready, authReady, pathname, user?.role, cloud, router]);
  useEffect(() => {
    if (!cloud || !authReady) return;
    let cancelled = false;
    async function revalidate() {
      if (document.visibilityState === "hidden") return;
      try {
        const fresh = await getSession();
        if (cancelled) return;
        if (
          !fresh ||
          ["email", "workspaceId", "role", "verifiedGoogle"].some(
            (key) => fresh.user?.[key] !== session.user?.[key],
          )
        ) {
          setRecords(
            Object.fromEntries(Object.keys(demoData).map((key) => [key, []])),
          );
          setDetailState({ path: "", payload: null, error: "" });
          setSession(fresh);
          setLoading(!!fresh?.user?.role);
          if (!fresh?.user?.role) router.replace("/");
        }
      } catch {}
    }
    revalidate();
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [
    cloud,
    authReady,
    pathname,
    session?.user?.email,
    session?.user?.role,
    session?.user?.workspaceId,
    router,
  ]);
  const inbox = useLiveNotifications({
    user,
    isDemo: !cloud,
    events: records.notifications || [],
    onDemoRead: markDemoRead,
  });
  const myProfile =
    data.employees.find(
      (e) => e.email?.toLowerCase() === user?.email?.toLowerCase(),
    ) || (selfProfile ? detail?.employee : null);
  const myPhoto = myProfile?.photoUrl || session?.user?.image;
  async function photoUploaded(employee, photoUrl) {
    setRecords((d) => ({
      ...d,
      employees: d.employees.map((e) =>
        e.id === employee.id
          ? {
              ...e,
              photoUrl,
            }
          : e,
      ),
    }));
    if (modal?.type === "employee" && modal.record?.id === employee.id)
      setModal((m) => ({
        ...m,
        record: {
          ...m.record,
          photoUrl,
        },
      }));
    if ((profileId || selfProfile) && cloud)
      setDetailState((current) =>
        current.payload?.employee?.id === employee.id
          ? {
              ...current,
              payload: {
                ...current.payload,
                employee: { ...current.payload.employee, photoUrl },
              },
            }
          : current,
      );
    setToast("Profile photo updated");
  }
  function requestedDestination() {
    if (typeof window === "undefined") return "/dashboard";
    const candidate = new URLSearchParams(window.location.search).get(
      "callbackUrl",
    );
    const destination = workspaceRoute(candidate || "/dashboard")?.path;
    return destination && destination !== "/" ? destination : "/dashboard";
  }
  async function loginCredentials({ email, password }) {
    if (signingIn) return;
    setSigningIn(true);
    setLoadError("");
    try {
      const sample =
        config.demoEnabled &&
        DEMO_CREDENTIALS.some(
          (account) => account.email === email.trim().toLowerCase(),
        );
      if (sample) {
        if (session) {
          await signOut({ redirect: false });
          setSession(null);
        }
        const response = await fetch("/api/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const result = await response.json();
        if (response.ok && demoUsers[result.role]) {
          try {
            setRecords(
              mergeDemoData(
                JSON.parse(localStorage.getItem("peopleos-v1") || "{}"),
              ),
            );
          } catch {
            setRecords(demoData);
          }
          setDemoRole(result.role);
          sessionStorage.setItem("peopleos-demo-role", result.role);
          setWorkspace(demoWorkspace);
          router.push(requestedDestination());
          return;
        }
      }
      if (!config.database) throw Error("Email or password is incorrect");
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error)
        throw Error("Email or password is incorrect");
      const fresh = await getSession();
      if (!fresh?.user?.role) throw Error("Email or password is incorrect");
      sessionStorage.removeItem("peopleos-demo-role");
      setDemoRole(null);
      setRecords(
        Object.fromEntries(Object.keys(demoData).map((key) => [key, []])),
      );
      setLoading(true);
      setSession(fresh);
      router.push(requestedDestination());
    } catch (error) {
      setLoadError(
        error.message ||
          "Unable to sign in. Check your email and password and try again.",
      );
    } finally {
      setSigningIn(false);
    }
  }
  async function logout() {
    sessionStorage.removeItem("peopleos-demo-role");
    setDemoRole(null);
    setModal(null);
    await fetch("/api/demo", { method: "DELETE" }).catch(() => {});
    if (cloud) {
      signOut({ callbackUrl: "/" });
      return;
    }
    router.replace("/");
  }
  function navigate(next) {
    if (!pages.includes(next)) return;
    if (PAGE_PATHS[next] !== routePath) {
      setModal(null);
      setMobile(false);
      router.push(PAGE_PATHS[next]);
      return;
    }
    setSearch("");
    setFilter("All departments");
    setMobile(false);
    setModal(null);
  }
  function openProfile(employee) {
    if (employee?.id) {
      setModal(null);
      router.push(profilePath(employee.id));
    }
  }
  function openRecord(resource, record) {
    if (record?.id && RESOURCE_PAGES[resource]) {
      setModal(null);
      router.push(recordPath(resource, record.id));
    }
  }
  const selectedEmployee = selfProfile
    ? cloud
      ? detail?.employee
      : myProfile
    : profileId
      ? cloud
        ? detail?.employee
        : data.employees.find((employee) => employee.id === profileId)
      : null;
  const selectedRecord = recordId
    ? cloud
      ? detail?.record
      : data[detailResource]?.find((record) => record.id === recordId)
    : null;
  const detailTitle = selfProfile
    ? selectedEmployee?.name || user?.name || t("Your account")
    : profileId
      ? selectedEmployee?.name || t("Employee profile")
      : selectedRecord?.title ||
        t(
          selectedRecord?.type ||
            selectedRecord?.cycle ||
            selectedRecord?.name ||
            "Record details",
        );
  function backToList() {
    navigate(
      (profileId && !isAdmin) || !pages.includes(page) ? "Overview" : page,
    );
  }
  async function save(resource, input, remove = false) {
    if (saving) return false;
    let record = {
      ...input,
    };
    const managerResources = [
      "employees",
      "jobs",
      "reviews",
      "announcements",
      "compliance",
    ];
    if (
      (managerResources.includes(resource) && !isAdmin) ||
      (resource === "memberships" && !isOwner)
    ) {
      setToast("Your role does not allow this action");
      return false;
    }
    setSaving(true);
    if (cloud) {
      try {
        const response = await fetch(`/api/${resource}`, {
          method: remove ? "DELETE" : record.id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(record),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
        record = {
          ...record,
          ...(result.id ? result : result.record || {}),
        };
        if (!record.id) {
          setRefreshKey((k) => k + 1);
          setModal(null);
          setToast("Changes saved successfully");
          setSaving(false);
          return true;
        }
      } catch (e) {
        setToast(e.message || "Save failed");
        setSaving(false);
        return false;
      }
    } else {
      if (!isAdmin && ["requests", "compensation"].includes(resource)) {
        const previous = records[resource].find((r) => r.id === record.id);
        if (
          previous &&
          previous.owner !== user.email &&
          previous.name !== user.name
        ) {
          setToast("You can only change your own records");
          setSaving(false);
          return false;
        }
        if (previous && previous.status !== "Pending") {
          setToast("Reviewed requests cannot be changed");
          setSaving(false);
          return false;
        }
        record = {
          ...record,
          owner: user.email,
          name: user.name,
          status: previous?.status || "Pending",
        };
      }
      if (
        resource === "memberships" &&
        (remove || record.role !== "admin" || record.status !== "Active") &&
        records.memberships.filter(
          (m) => m.role === "admin" && m.status === "Active",
        ).length === 1 &&
        records.memberships.some(
          (m) => m.id === record.id && m.role === "admin",
        )
      ) {
        setToast("Keep at least one active administrator");
        setSaving(false);
        return false;
      }
      if (!record.id) record.id = crypto.randomUUID();
      if (resource === "employees") {
        record.employeeCode = (
          record.employeeCode || localRecordCode(record.id, "EMP")
        )
          .trim()
          .toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(record.employeeCode)) {
          setToast(
            "Employee ID must contain 3 to 32 letters, numbers, underscores, or dashes",
          );
          setSaving(false);
          return false;
        }
        if (
          records.employees.some(
            (e) => e.id !== record.id && e.employeeCode === record.employeeCode,
          )
        ) {
          setToast("This employee ID already exists");
          setSaving(false);
          return false;
        }
      }
      if (resource === "memberships")
        record.memberCode =
          record.memberCode || localRecordCode(record.id, "MEM");
      record.workspaceId = demoWorkspace.id;
    }
    const notification = !cloud
      ? buildDemoNotification(resource, record, remove, user, records.employees)
      : null;
    setRecords((d) => ({
      ...d,
      [resource]: remove
        ? d[resource].filter((x) => x.id !== record.id)
        : d[resource].some((x) => x.id === record.id)
          ? d[resource].map((x) => (x.id === record.id ? record : x))
          : [...d[resource], record],
      ...(!cloud
        ? {
            notifications: notification
              ? [notification, ...d.notifications]
              : d.notifications,
            audit: [
              {
                id: crypto.randomUUID(),
                action: remove ? "Deleted" : "Saved",
                resource,
                actor: user.email,
                createdAt: new Date().toISOString(),
              },
              ...d.audit,
            ],
          }
        : {}),
    }));
    if (isDetail) {
      if (remove) backToList();
      else if (cloud)
        setDetailState((current) =>
          current.path === routePath &&
          current.payload &&
          (profileId || selfProfile
            ? current.payload.employee?.id === record.id
            : current.payload.record?.id === record.id)
            ? {
                ...current,
                payload:
                  profileId || selfProfile
                    ? {
                        ...current.payload,
                        employee: { ...current.payload.employee, ...record },
                      }
                    : { ...current.payload, record },
              }
            : current,
        );
    }
    setToast(
      remove ? "Record deleted successfully" : "Changes saved successfully",
    );
    if (cloud && resource === "memberships") {
      const fresh = await getSession();
      setSession(fresh);
    }
    setSaving(false);
    return true;
  }
  function exportCSV(resource) {
    setModal({
      type: "export",
      resource,
    });
  }
  const employees = data.employees.filter(
    (e) =>
      (filter === "All departments" || e.department === filter) &&
      `${e.name} ${e.email} ${e.department} ${e.role}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pending = data.requests.filter((r) => r.status === "Pending");
  const dateLabel = new Date().toLocaleDateString(
    locale === "ar" ? "ar-AE" : "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Dubai",
    },
  );
  const active = data.employees.filter((e) => e.status !== "On leave").length;
  function employeeTable(compact = false) {
    const rows = compact ? employees.slice(0, viewAll ? 100 : 4) : employees;
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label={t("Select all visible employees")}
                  type="checkbox"
                  onChange={(e) => {
                    document
                      .querySelectorAll(".employee-select")
                      .forEach((el) => (el.checked = e.target.checked));
                  }}
                />
              </th>
              <th>
                {t("Employee")}
                <ChevronDown size={12} />
              </th>
              <th>{t("Department")}</th>
              <th>{t("Employment")}</th>
              <th>{t("Location")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <input
                    className="employee-select"
                    aria-label={`Select ${e.name}`}
                    type="checkbox"
                  />
                </td>
                <td>
                  <div className="person">
                    <Avatar
                      name={e.name}
                      color={e.color}
                      photoUrl={e.photoUrl}
                    />
                    <div>
                      <Link
                        className="record-name-link"
                        href={profilePath(e.id)}
                      >
                        {e.name}
                      </Link>
                      <span>
                        <bdi>{e.employeeCode}</bdi> · {e.email}
                      </span>
                    </div>
                  </div>
                </td>
                <td>{e.department}</td>
                <td>
                  <Badge>{e.status}</Badge>
                </td>
                <td>
                  <span className="location">
                    <MapPin size={12} />
                    {e.location}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View profile pass for ${e.name}`}
                    title={t("Profile pass")}
                    onClick={() =>
                      setModal({
                        type: "profile",
                        record: e,
                      })
                    }
                  >
                    <QrCode size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Manage ${e.name}`}
                    onClick={() =>
                      setModal({
                        type: isAdmin ? "employee" : "profile",
                        record: e,
                      })
                    }
                  >
                    <Ellipsis size={19} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">{t("No employees match your search.")}</div>
        )}
      </div>
    );
  }
  function submitForm(e) {
    e.preventDefault();
    if (saving) return;
    const fields = Object.fromEntries(new FormData(e.target));
    const resource = {
      employee: "employees",
      request: "requests",
      job: "jobs",
      announcement: "announcements",
      review: "reviews",
      compliance: "compliance",
      compensation: "compensation",
      membership: "memberships",
    }[modal.type];
    if (modal.type === "request" && fields.to < fields.from) {
      setToast("End date must be after the start date");
      return;
    }
    if (modal.type === "employee") {
      fields.salary = Number(fields.salary);
      if (!fields.employeeCode?.trim()) delete fields.employeeCode;
    }
    if (modal.type === "compensation") {
      fields.amount = Number(fields.amount);
      fields.currency = "USD";
      if (!modal.record?.id) {
        fields.status = "Pending";
        fields.submittedAt = new Date().toISOString();
        fields.owner = user.email;
        fields.name = user.name;
      }
      if (!Number.isFinite(fields.amount) || fields.amount <= 0) {
        setToast("Enter an amount greater than zero");
        return;
      }
    }
    if (modal.type === "job")
      fields.applicants = Number(modal.record?.applicants || 0);
    const record = {
      ...modal.record,
      ...fields,
    };
    if (modal.type === "request" && !record.status) record.status = "Pending";
    if (modal.type === "employee" && !record.color) record.color = "purple";
    save(resource, record).then((ok) => ok && setModal(null));
  }
  function field(
    label,
    name,
    type = "text",
    options = null,
    defaultValue = "",
  ) {
    return (
      <label className="field" key={name}>
        {t(label)}
        {options ? (
          <select
            name={name}
            aria-label={label}
            defaultValue={modal?.record?.[name] || defaultValue}
            required
          >
            {options.map((v) => (
              <option key={v} value={v}>
                {t(v)}
              </option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea
            name={name}
            defaultValue={modal?.record?.[name] || defaultValue}
            required
            rows={3}
          />
        ) : (
          <input
            name={name}
            type={type}
            min={type === "number" ? 0 : undefined}
            step={type === "number" ? "0.01" : undefined}
            maxLength={200}
            defaultValue={modal?.record?.[name] ?? defaultValue}
            required
          />
        )}
      </label>
    );
  }
  if (!route) return null;
  if (!ready || !authReady)
    return (
      <PageSkeleton
        page={ready && !demoRole && !session ? "Login" : skeletonPage}
        fullPage
      />
    );
  if (
    session?.user?.verifiedGoogle &&
    !["admin", "hr", "employee"].includes(session.user.role)
  )
    return (
      <WorkspaceSetup
        user={session.user}
        onLogout={logout}
        onCreate={async (name) => {
          const response = await fetch("/api/workspace", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
            }),
          });
          const result = await response.json();
          const current = await getSession();
          if (!response.ok && !current?.user?.role)
            throw Error(result.error || "Workspace setup failed");
          if (!current?.user?.role)
            throw Error(
              "Workspace created. Please sign out and sign in again to continue.",
            );
          setSession(current);
        }}
      />
    );
  if (!user)
    return (
      <LoginScreen
        onCredentials={loginCredentials}
        credentialsEnabled={!!config.database}
        onGoogle={() =>
          signIn("google", {
            callbackUrl: pathname === "/" ? requestedDestination() : routePath,
          })
        }
        loading={signingIn}
        demoEnabled={config.demoEnabled === true}
        googleEnabled={!!config.google}
        dark={dark}
        onToggleTheme={() => setDark(!dark)}
        error={
          loadError ||
          (session && !session.user?.role && !session.user?.verifiedGoogle
            ? "Your session has expired. Sign in again."
            : "") ||
          (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("error")
            ? "Sign-in was not completed. Ask your workspace administrator to provision your email."
            : "")
        }
      />
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
            <span />
          </span>
          people<span className="brand-os">os</span>
          <span className="brand-dot">®</span>
        </a>
        <button
          className="workspace"
          onClick={() => navigate(isOwner ? "Workspace" : "Settings")}
        >
          <span className="workspace-icon">
            <Building2 size={19} />
          </span>
          <span>
            <strong>{cloud ? workspace.name : settings.company}</strong>
            <small>{t(cloud ? workspace.plan : "Demo workspace")}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <span className="nav-label">{t("WORKSPACE")}</span>
        <nav>
          {nav
            .filter(([label]) => pages.includes(label))
            .map(([label, Icon]) => (
              <button
                key={label}
                className={`nav-item ${page === label ? "active" : ""}`}
                onClick={() => navigate(label)}
              >
                <Icon size={18} />
                <span>{t(label)}</span>
                {label === "Time off" && pending.length > 0 && (
                  <b>{pending.length}</b>
                )}
                {label === "Recruitment" && <span className="nav-dot" />}
              </button>
            ))}
        </nav>
        <span className="nav-label tools-label">{t("ORGANIZATION")}</span>
        <button
          className={`nav-item ${page === "Announcements" ? "active" : ""}`}
          onClick={() => navigate("Announcements")}
        >
          <Mail size={18} />
          <span>{t("Announcements")}</span>
        </button>
        {isOwner && (
          <button
            className={`nav-item ${page === "Workspace" ? "active" : ""}`}
            onClick={() => navigate("Workspace")}
          >
            <Building2 size={18} />
            <span>{t("Workspace & access")}</span>
          </button>
        )}
        <button
          className={`nav-item ${page === "Settings" ? "active" : ""}`}
          onClick={() => navigate("Settings")}
        >
          <Settings size={18} />
          <span>{t("Settings")}</span>
        </button>
        <div className="sidebar-bottom">
          {/* <div className="help-card">
            <div className="help-icon">
              <Heart size={18} />
            </div>
            <strong>{t("A little help goes a long way.")}</strong>
            <p>{t("Let\u2019s make work better, together.")}</p>
            <button
              onClick={() =>
                setModal({
                  type: "help",
                })
              }
            >
              {t("Visit help center")}
              <ArrowUpRight size={14} />
            </button>
          </div> */}
          <div
            className="theme-switch"
            role="group"
            aria-label={t("Appearance")}
          >
            <button
              type="button"
              aria-pressed={!dark}
              className={!dark ? "selected" : ""}
              onClick={() => setDark(false)}
            >
              <Sun size={15} />
              {t("Light")}
            </button>
            <button
              type="button"
              aria-pressed={dark}
              className={dark ? "selected" : ""}
              onClick={() => setDark(true)}
            >
              <Moon size={15} />
              {t("Dark")}
            </button>
          </div>
          <button
            className="account"
            onClick={() =>
              setModal({
                type: "account",
              })
            }
          >
            <Avatar
              name={user?.name || "Alex Morgan"}
              photoUrl={myPhoto}
              color="green"
            />
            <span>
              <strong>{user?.name || "Alex Morgan"}</strong>
              <small>{t(roleNames[user?.role] || "Team member")}</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobile(!mobile)}
              aria-label={t("Toggle menu")}
            >
              <Menu size={20} />
            </button>
            <nav aria-label={t("Breadcrumb")}>
              <ol>
                <li>
                  <Link href="/dashboard">{t("Workspace")}</Link>
                </li>
                {isDetail ? (
                  <>
                    {!selfProfile && (
                      <>
                        <li aria-hidden="true">
                          <ChevronRight size={13} />
                        </li>
                        <li>
                          <Link
                            href={
                              pages.includes(page)
                                ? PAGE_PATHS[page]
                                : "/dashboard"
                            }
                          >
                            {t(pages.includes(page) ? page : "Overview")}
                          </Link>
                        </li>
                      </>
                    )}
                    <li aria-hidden="true">
                      <ChevronRight size={13} />
                    </li>
                    <li>
                      <span aria-current="page">{detailTitle}</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li aria-hidden="true">
                      <ChevronRight size={13} />
                    </li>
                    <li>
                      <span aria-current="page">{t(page)}</span>
                    </li>
                  </>
                )}
              </ol>
            </nav>
          </div>
          <div className="top-actions">
            <LanguageSwitcher />
            <button
              className="icon-button header-profile-scanner"
              aria-label={t("Scan employee profile")}
              title={t("Scan employee profile")}
              onClick={() =>
                setModal({
                  type: "scanner",
                })
              }
            >
              <ScanLine size={19} />
            </button>
            <button
              type="button"
              className="icon-button header-theme-toggle"
              aria-label={t(
                dark ? "Switch to light mode" : "Switch to dark mode",
              )}
              title={t(dark ? "Switch to light mode" : "Switch to dark mode")}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="live-status">
              <i />
              {cloud
                ? t(roleNames[user?.role])
                : `${t(roleNames[user?.role])} ${t("Demo")}`}
            </span>
            <button
              className="icon-button"
              aria-label={t("Help center")}
              onClick={() =>
                setModal({
                  type: "help",
                })
              }
            >
              <HelpCircle size={19} />
            </button>
            <NotificationBell
              {...inbox}
              onRead={inbox.markRead}
              onNavigate={navigate}
            />
            <span className="top-divider" />
            <button
              className="avatar-button"
              aria-label={t("Your account")}
              onClick={() =>
                setModal({
                  type: "account",
                })
              }
            >
              <Avatar
                name={user?.name || "Alex Morgan"}
                photoUrl={myPhoto}
                color="green"
                small
              />
            </button>
          </div>
        </header>
        <main>
          <div className="workspace-context">
            <span>
              <Building2 size={12} />
              {cloud ? workspace.name : settings.company}
            </span>
            <span className="permission-pill">
              <ShieldCheck size={11} />
              {t(roleNames[user.role])}
            </span>
            {!cloud && (
              <span className="demo-context">
                {t("Demo preview \xB7 sample records")}
              </span>
            )}
            <button onClick={logout}>
              <LogOut size={12} />
              {t(cloud ? "Sign out" : "Switch demo role")}
            </button>
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{t("YOUR PEOPLE. YOUR WORKPLACE.")}</div>
              <h1>
                {isDetail ? (
                  detailTitle
                ) : page === "Overview" ? (
                  <BlurText
                    text={t("Good morning, {name}", {
                      name: user?.name?.split(" ")[0] || "Alex",
                    })}
                    delay={60}
                    animateBy="words"
                  />
                ) : (
                  t(page)
                )}
                <span className="greeting-dot">
                  {t(!isDetail && page === "Overview" ? "." : "")}
                </span>
              </h1>
              <p>
                {isDetail
                  ? t(
                      profileId || selfProfile
                        ? "Your people, beyond the directory."
                        : "Every detail, in one place.",
                    )
                  : t(
                      {
                        Overview:
                          "Here’s what’s happening with your team today.",
                        Employees: "Good people. Great things. Meet your team.",
                        "Time off":
                          "A little time away makes all the difference.",
                        Recruitment: "Build your next great team.",
                        Payroll: "A clear view of your team’s compensation.",
                        Performance: "Celebrate progress. Create room to grow.",
                        Compensation:
                          "Fair decisions. Clear records. A better employee experience.",
                        Compliance:
                          "Keep your workplace reviews moving forward.",
                        Workspace:
                          "Your organization, your people, the right permissions.",
                        Announcements:
                          "Keep everyone connected to what matters.",
                        Settings: "Make this workspace feel like yours.",
                      }[page],
                    )}
              </p>
            </div>
            <div className="heading-actions">
              {isDetail ? null : page === "Overview" ? (
                <>
                  <span className="today">
                    <CalendarDays size={15} />
                    {dateLabel}
                  </span>
                  {isAdmin && (
                    <Button
                      onClick={() =>
                        setModal({
                          type: "employee",
                        })
                      }
                    >
                      <Plus size={16} />
                      {t("Add employee")}
                    </Button>
                  )}
                </>
              ) : page === "Employees" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => exportCSV("employees")}
                  >
                    <Download size={15} />
                    {t("Export")}
                  </Button>
                  {isAdmin && (
                    <Button
                      onClick={() =>
                        setModal({
                          type: "employee",
                        })
                      }
                    >
                      <Plus size={16} />
                      {t("Add employee")}
                    </Button>
                  )}
                </>
              ) : page === "Time off" ? (
                <Button
                  onClick={() =>
                    setModal({
                      type: "request",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("Request time off")}
                </Button>
              ) : page === "Recruitment" && isAdmin ? (
                <Button
                  onClick={() =>
                    setModal({
                      type: "job",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("Post a job")}
                </Button>
              ) : page === "Performance" && isAdmin ? (
                <Button
                  onClick={() =>
                    setModal({
                      type: "review",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("New review")}
                </Button>
              ) : page === "Compensation" ? (
                <Button
                  onClick={() =>
                    setModal({
                      type: "compensation",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("New request")}
                </Button>
              ) : page === "Compliance" && isAdmin ? (
                <Button
                  onClick={() =>
                    setModal({
                      type: "compliance",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("Add check")}
                </Button>
              ) : page === "Announcements" && isAdmin ? (
                <Button
                  onClick={() =>
                    setModal({
                      type: "announcement",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("Create announcement")}
                </Button>
              ) : null}
            </div>
          </div>
          {loading ||
          (!loadError &&
            cloud &&
            isDetail &&
            (detailState.path !== routePath || !detailState.complete)) ? (
            selfProfile && !myProfile ? (
              <AccountProfileSkeleton />
            ) : (
              <PageSkeleton page={skeletonPage} showHeading={false} />
            )
          ) : loadError ||
            (isDetail &&
              detailState.path === routePath &&
              detailState.error) ? (
            <div className="card workspace-error" role="alert">
              <ShieldCheck size={30} />
              <h2>{t("Workspace unavailable")}</h2>
              <p>{loadError || detailState.error}</p>
              <Button onClick={() => setRefreshKey((k) => k + 1)}>
                <RefreshCw size={14} />
                {t("Try again")}
              </Button>
              <Button variant="outline" onClick={logout}>
                {t("Back to sign in")}
              </Button>
            </div>
          ) : isDetail ? (
            selfProfile && !selectedEmployee ? (
              <AccountProfile
                user={{ ...user, image: myPhoto }}
                workspaceName={cloud ? workspace.name : settings.company}
                onBack={() => navigate("Overview")}
                onSettings={() => navigate("Settings")}
              />
            ) : profileId || selfProfile ? (
              selectedEmployee ? (
                <EmployeeProfile
                  employee={selectedEmployee}
                  user={user}
                  workspaceName={cloud ? workspace.name : settings.company}
                  counts={cloud ? detail?.counts : undefined}
                  requests={cloud ? detail?.requests || [] : data.requests}
                  reviews={cloud ? detail?.reviews || [] : data.reviews}
                  compensation={
                    cloud ? detail?.compensation || [] : data.compensation
                  }
                  onBack={backToList}
                  onEdit={(employee) =>
                    setModal({ type: "employee", record: employee })
                  }
                  onPass={(employee) =>
                    setModal({ type: "profile", record: employee })
                  }
                  onPhotoUploaded={(url) =>
                    photoUploaded(selectedEmployee, url)
                  }
                  isDemo={!cloud}
                />
              ) : (
                <DetailNotFound onBack={backToList} />
              )
            ) : (
              <RecordDetails
                resource={detailResource}
                record={selectedRecord}
                user={user}
                employees={data.employees}
                onBack={backToList}
                onSetPassword={
                  cloud && isOwner
                    ? (record) => setModal({ type: "credentials", record })
                    : undefined
                }
                onEdit={(record) =>
                  setModal({ type: RESOURCE_MODAL[detailResource], record })
                }
              />
            )
          ) : !pages.includes(page) ? (
            <DetailNotFound onBack={() => navigate("Overview")} />
          ) : (
            <>
              {page === "Overview" && !isAdmin && (
                <RoleDashboard
                  user={user}
                  data={data}
                  onNavigate={navigate}
                  onRequest={() =>
                    setModal({
                      type: "request",
                    })
                  }
                />
              )}
              {page === "Overview" && isAdmin && (
                <>
                  {/* <motion.div
                    className="welcome-banner"
                    initial={{
                      opacity: 0,
                      y: 10,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                  >
                    <Spotlight className="people-spotlight" fill="#ffb08a" />
                    <div className="banner-content">
                      <span className="banner-pill">
                        <span />
                        {t("A WORKPLACE THAT WORKS FOR EVERYONE")}
                      </span>
                      <h2>
                        {t("Great teams start")}
                        <br />
                        {t("with happy people.")}
                      </h2>
                      <p>
                        {t("Less paperwork. More people work.")}
                        <br />
                        {t("Your entire workplace, connected in one place.")}
                      </p>
                      <button onClick={() => navigate("Employees")}>
                        {t("Meet your people")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="banner-art" aria-hidden="true">
                      <div className="art-orbit orbit-one" />
                      <div className="art-orbit orbit-two" />
                      <div className="art-orbit orbit-three" />
                      <div className="art-dot dot-one" />
                      <div className="art-dot dot-two" />
                      <div className="floating-profile profile-one">
                        <span className="emoji-person">👩🏻‍💻</span>
                      </div>
                      <div className="floating-profile profile-two">
                        <span className="emoji-person">👨🏽‍💼</span>
                      </div>
                      <div className="floating-profile profile-three">
                        <span className="emoji-person">👩🏾‍🦱</span>
                      </div>
                      <motion.div
                        className="happy-card"
                        animate={{
                          y: [0, -5, 0],
                        }}
                        transition={{
                          duration: 5,
                          repeat: Infinity,
                        }}
                      >
                        <span className="happy-icon">
                          <Heart size={18} fill="currentColor" />
                        </span>
                        <div>
                          <strong>{t("People first. Always.")}</strong>
                          <span>{t("A little care. A big difference.")}</span>
                        </div>
                        <span className="sparkle">✦</span>
                      </motion.div>
                      <div className="tiny-sparkle">✦</div>
                    </div>
                  </motion.div> */}
                  <div className="stats-grid">
                    {[
                      {
                        label: "Total employees",
                        value: data.employees.length,
                        icon: Users,
                        change: "Your growing team",
                        color: "blue",
                        sub:
                          "Across " +
                          new Set(data.employees.map((e) => e.department))
                            .size +
                          " departments",
                      },
                      {
                        label: "Active employees",
                        value: active,
                        icon: BriefcaseBusiness,
                        change:
                          Math.round(
                            (active / Math.max(data.employees.length, 1)) * 100,
                          ) + "% of your team",
                        color: "green",
                        sub: "Current employee records",
                      },
                      {
                        label: "Leave requests",
                        value: pending.length,
                        icon: CalendarDays,
                        change: pending.length + " pending requests",
                        color: "peach",
                        sub: "Awaiting a review from HR",
                      },
                      {
                        label: "Open positions",
                        value: data.jobs.filter((j) => j.status === "Open")
                          .length,
                        icon: BriefcaseBusiness,
                        change:
                          data.jobs.reduce(
                            (s, j) => s + Number(j.applicants),
                            0,
                          ) + " total applicants",
                        color: "purple",
                        sub: "Find your next great hire",
                      },
                    ].map((s, i) => (
                      <AnimatedCard className="stat-card" key={s.label}>
                        <div className="stat-top">
                          <span>{t(s.label)}</span>
                          <span className={`stat-icon ${s.color}`}>
                            <s.icon size={17} />
                          </span>
                        </div>
                        <div className="stat-value">
                          <AnimatedNumber
                            value={String(s.value).padStart(2, "0")}
                          />
                          <span className="stat-change">
                            <ArrowUpRight size={12} />
                            {t(s.change)}
                          </span>
                        </div>
                        <p>{t(s.sub)}</p>
                      </AnimatedCard>
                    ))}
                  </div>
                  <WorkforceInsights
                    employees={data.employees}
                    requests={data.requests}
                    compliance={data.compliance}
                    compensation={data.compensation}
                  />
                  <div className="dashboard-middle">
                    <TeamGrowth
                      employees={data.employees}
                      isDemo={!cloud}
                      onViewReport={() => navigate("Employees")}
                    />
                    <section className="card requests-card">
                      <div className="card-heading">
                        <div>
                          <h3>
                            {t("Needs your attention")}
                            <span className="count-pill">{pending.length}</span>
                          </h3>
                          <p>{t("A few things could use your okay.")}</p>
                        </div>
                        <button
                          aria-label={t("Open all requests")}
                          className="icon-button"
                          onClick={() => navigate("Time off")}
                        >
                          <Ellipsis size={19} />
                        </button>
                      </div>
                      <div className="request-list">
                        {pending.slice(0, 3).map((r, i) => (
                          <div className="request-preview" key={r.id}>
                            <Avatar
                              name={r.name}
                              color={i ? "blue" : "pink"}
                              photoUrl={
                                data.employees.find((e) => e.name === r.name)
                                  ?.photoUrl
                              }
                            />
                            <div>
                              <strong>{r.name}</strong>
                              <p>
                                {r.type}{" "}
                                <span>
                                  ·{" "}
                                  {new Date(
                                    r.from + "T12:00:00",
                                  ).toLocaleDateString(
                                    locale === "ar" ? "ar-AE" : "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}
                                </span>
                              </p>
                              <span className="request-reason">{r.reason}</span>
                            </div>
                            <div
                              className="approval-actions"
                              style={
                                !isAdmin
                                  ? {
                                      display: "none",
                                    }
                                  : undefined
                              }
                            >
                              <button
                                aria-label={`Decline ${r.name}'s request`}
                                onClick={() =>
                                  save("requests", {
                                    ...r,
                                    status: "Declined",
                                  })
                                }
                              >
                                <X size={14} />
                              </button>
                              <button
                                className="approve"
                                aria-label={`Approve ${r.name}'s request`}
                                onClick={() =>
                                  save("requests", {
                                    ...r,
                                    status: "Approved",
                                  })
                                }
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {!pending.length && (
                          <div className="all-caught">
                            <CheckCheck size={30} />
                            <strong>{t("All caught up!")}</strong>
                            <span>{t("Your team is in good hands.")}</span>
                          </div>
                        )}
                      </div>
                      <button
                        className="card-bottom-link"
                        onClick={() => navigate("Time off")}
                      >
                        {t("View all requests")}
                        <ArrowRight size={14} />
                      </button>
                    </section>
                  </div>
                  <div className="dashboard-bottom">
                    <section className="card employee-card">
                      <div className="card-heading">
                        <div className="inline-heading">
                          <h3>{t("Employee directory")}</h3>
                          <span className="count-pill">
                            {data.employees.length} people
                          </span>
                        </div>
                        <button
                          className="text-link"
                          onClick={() => navigate("Employees")}
                        >
                          {t("View all employees")}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <div className="directory-tools">
                        <label className="search-box">
                          <Search size={15} />
                          <input
                            placeholder={t("Search employees...")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <span>⌘ K</span>
                        </label>
                        <select
                          className="mini-select"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          <option value="All departments">
                            {t("All departments")}
                          </option>
                          {departments.map((d) => (
                            <option key={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      {employeeTable(true)}
                    </section>
                    <section className="card culture-card">
                      <div className="card-heading">
                        <h3>{t("Around the office")}</h3>
                        <span className="little-sparkle">✧</span>
                      </div>
                      <div className="culture-illustration">
                        <span>☕</span>
                        <i />
                        <span>🌿</span>
                        <div>
                          {t("good people.")}
                          <br />
                          <b>{t("great energy.")}</b>
                        </div>
                      </div>
                      <div className="culture-copy">
                        <span className="culture-category">
                          {t("CULTURE & CONNECTION")}
                        </span>
                        <h3>
                          {data.announcements[0]?.title ||
                            "Make room for connection"}
                        </h3>
                        <p>
                          {data.announcements[0]?.body ||
                            "Share a team update to get the conversation started."}
                        </p>
                        <button onClick={() => navigate("Announcements")}>
                          {t("See what\u2019s happening")}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </section>
                  </div>
                </>
              )}
              {page === "Compliance" && isAdmin && (
                <CompliancePanel
                  records={data.compliance}
                  onEdit={(r) => openRecord("compliance", r)}
                  onAdd={() =>
                    setModal({
                      type: "compliance",
                    })
                  }
                  onExport={() => exportCSV("compliance")}
                />
              )}
              {page === "Compensation" && (
                <CompensationPanel
                  user={user}
                  records={data.compensation}
                  employees={data.employees}
                  onEdit={(r) => openRecord("compensation", r)}
                  onAdd={() =>
                    setModal({
                      type: "compensation",
                    })
                  }
                  onExport={() => exportCSV("compensation")}
                />
              )}
              {page === "Workspace" && isOwner && (
                <WorkspacePanel
                  workspace={
                    cloud
                      ? workspace
                      : {
                          ...workspace,
                          name: settings.company,
                        }
                  }
                  user={user}
                  members={data.memberships}
                  audit={data.audit}
                  onEdit={(r) => openRecord("memberships", r)}
                  onAdd={() =>
                    setModal({
                      type: "membership",
                    })
                  }
                />
              )}
              {page === "Employees" && (
                <section className="card">
                  <div className="card-heading">
                    <div className="inline-heading">
                      <h3>{t("All employees")}</h3>
                      <span className="count-pill">
                        {employees.length} people
                      </span>
                    </div>
                  </div>
                  <div className="directory-tools">
                    <label className="search-box">
                      <Search size={15} />
                      <input
                        placeholder={t("Search name, role, or department...")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      className="mini-select"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="All departments">
                        {t("All departments")}
                      </option>
                      {departments.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {employeeTable()}
                  <div className="table-footer">
                    {t("Showing")}
                    {employees.length}
                    {t("employees")}
                    <span>{t("People are at the heart of everything.")}</span>
                  </div>
                </section>
              )}
              {page === "Time off" && (
                <>
                  <div className="summary-strip">
                    <div>
                      <span>{t("Pending approval")}</span>
                      <strong>{pending.length}</strong>
                    </div>
                    <div>
                      <span>{t("Approved requests")}</span>
                      <strong>
                        {
                          data.requests.filter((r) => r.status === "Approved")
                            .length
                        }
                      </strong>
                    </div>
                    <div>
                      <span>{t("Requests recorded")}</span>
                      <strong>
                        {data.requests.length}{" "}
                        <small>{t("in this workspace")}</small>
                      </strong>
                    </div>
                  </div>
                  <section className="card">
                    <div className="card-heading">
                      <h3>{t("Time off requests")}</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportCSV("requests")}
                      >
                        <Download size={14} />
                        {t("Export")}
                      </Button>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("Employee")}</th>
                            <th>{t("Leave type")}</th>
                            <th>{t("Dates")}</th>
                            <th>{t("Status")}</th>
                            <th>{t("Actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.requests.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <div className="person">
                                  <Avatar
                                    name={r.name}
                                    color="pink"
                                    photoUrl={
                                      data.employees.find(
                                        (e) => e.name === r.name,
                                      )?.photoUrl
                                    }
                                  />
                                  <div>
                                    <Link
                                      className="record-name-link"
                                      href={recordPath("requests", r.id)}
                                    >
                                      {r.name}
                                    </Link>
                                    <span>{r.reason}</span>
                                  </div>
                                </div>
                              </td>
                              <td>{r.type}</td>
                              <td>
                                {r.from} → {r.to}
                              </td>
                              <td>
                                <Badge>{r.status}</Badge>
                              </td>
                              <td>
                                <div className="row-actions">
                                  {r.status === "Pending" && isAdmin && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          save("requests", {
                                            ...r,
                                            status: "Declined",
                                          })
                                        }
                                      >
                                        {t("Decline")}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          save("requests", {
                                            ...r,
                                            status: "Approved",
                                          })
                                        }
                                      >
                                        <Check size={13} />
                                        {t("Approve")}
                                      </Button>
                                    </>
                                  )}
                                  {(isAdmin || r.status === "Pending") && (
                                    <button
                                      aria-label={t("Edit request")}
                                      className="icon-button"
                                      onClick={() =>
                                        setModal({
                                          type: "request",
                                          record: r,
                                        })
                                      }
                                    >
                                      <Ellipsis size={18} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data.requests.length && (
                        <div className="empty">
                          {t(
                            "No time off requests yet. Make your first request above.",
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
              {page === "Recruitment" && (
                <>
                  <div className="section-intro">
                    <span className="count-pill">
                      {data.jobs.filter((j) => j.status === "Open").length}
                      {t("open positions")}
                    </span>
                    <p>{t("The next chapter starts with the right people.")}</p>
                  </div>
                  <div className="job-grid">
                    {data.jobs.map((j, i) => (
                      <motion.section
                        initial={{
                          opacity: 0,
                          y: 10,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        transition={{
                          delay: i * 0.05,
                        }}
                        className="card job-card"
                        key={j.id}
                      >
                        <div className="job-top">
                          <span
                            className={`job-icon ${["purple", "blue", "peach"][i % 3]}`}
                          >
                            <BriefcaseBusiness size={24} />
                          </span>
                          <Badge>{j.status}</Badge>
                        </div>
                        <span className="eyebrow">{j.department}</span>
                        <h2>
                          <Link
                            className="record-name-link"
                            href={recordPath("jobs", j.id)}
                          >
                            {j.title}
                          </Link>
                        </h2>
                        <p>
                          <MapPin size={14} />
                          {j.location}
                          <span>·</span>
                          {j.type}
                        </p>
                        <div className="job-applicants">
                          <Users size={16} />
                          <strong>{j.applicants}</strong>
                          {t("applicants")}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => openRecord("jobs", j)}
                        >
                          {t("Manage position")}
                          <ArrowUpRight size={15} />
                        </Button>
                      </motion.section>
                    ))}
                  </div>
                  {!data.jobs.length && (
                    <div className="card empty">
                      {t("No positions yet. Post your first job.")}
                    </div>
                  )}
                </>
              )}
              {page === "Payroll" && (
                <>
                  <div className="summary-strip">
                    <div>
                      <span>{t("Annual base compensation")}</span>
                      <strong>
                        $
                        {data.employees
                          .reduce((s, e) => s + Number(e.salary || 0), 0)
                          .toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span>{t("Estimated monthly base")}</span>
                      <strong>
                        $
                        {Math.round(
                          data.employees.reduce(
                            (s, e) => s + Number(e.salary || 0),
                            0,
                          ) / 12,
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span>{t("Team members")}</span>
                      <strong>{data.employees.length}</strong>
                    </div>
                  </div>
                  <section className="card">
                    <div className="card-heading">
                      <div>
                        <h3>{t("Compensation register")}</h3>
                        <p>
                          {t(
                            "Base salaries in USD. Edit compensation through employee profiles.",
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportCSV("employees")}
                      >
                        <Download size={14} />
                        {t("Export register")}
                      </Button>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("Employee")}</th>
                            <th>{t("Department")}</th>
                            <th>{t("Annual base")}</th>
                            <th>{t("Monthly base")}</th>
                            <th>{t("Manage")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.employees.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <div className="person">
                                  <Avatar
                                    name={e.name}
                                    color={e.color}
                                    photoUrl={e.photoUrl}
                                  />
                                  <strong>{e.name}</strong>
                                </div>
                              </td>
                              <td>{e.department}</td>
                              <td>${Number(e.salary || 0).toLocaleString()}</td>
                              <td>
                                $
                                {Math.round(
                                  Number(e.salary || 0) / 12,
                                ).toLocaleString()}
                              </td>
                              <td>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openProfile(e)}
                                >
                                  {t("View details")}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <p className="footnote">
                    {t(
                      "Compensation planning only. Payment processing and tax calculations are not connected.",
                    )}
                  </p>
                </>
              )}
              {page === "Performance" && (
                <section className="card">
                  <div className="card-heading">
                    <h3>{t("Performance reviews")}</h3>
                    <span className="count-pill">Q4 2026</span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Employee")}</th>
                          <th>{t("Review cycle")}</th>
                          <th>{t("Rating / 5")}</th>
                          <th>{t("Status")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.reviews.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <div className="person">
                                <Avatar
                                  name={r.name}
                                  color="purple"
                                  photoUrl={
                                    data.employees.find(
                                      (e) => e.name === r.name,
                                    )?.photoUrl
                                  }
                                />
                                <strong>{r.name}</strong>
                              </div>
                            </td>
                            <td>{r.cycle}</td>
                            <td>
                              <span className="rating">★ {r.score}</span>
                            </td>
                            <td>
                              <Badge>{r.status}</Badge>
                            </td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRecord("reviews", r)}
                              >
                                {t("View review")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!data.reviews.length && (
                      <div className="empty">
                        {t("Create a review to start a growth conversation.")}
                      </div>
                    )}
                  </div>
                </section>
              )}
              {page === "Announcements" && (
                <AnnouncementsPanel
                  records={data.announcements}
                  canManage={isAdmin}
                  onEdit={(r) =>
                    setModal({
                      type: "announcement",
                      record: r,
                    })
                  }
                  onAdd={() =>
                    setModal({
                      type: "announcement",
                    })
                  }
                />
              )}
              {page === "Settings" && (
                <>
                  <SettingsPanel
                    photoUrl={myPhoto}
                    photoControl={
                      myProfile ? (
                        <PhotoUploader
                          employee={myProfile}
                          isDemo={!cloud}
                          compact
                          onUploaded={(url) => photoUploaded(myProfile, url)}
                        />
                      ) : (
                        <span className="footnote">
                          {t("Link an employee profile to upload your photo.")}
                        </span>
                      )
                    }
                    user={user}
                    workspace={
                      cloud
                        ? workspace
                        : {
                            ...workspace,
                            name: settings.company,
                          }
                    }
                    settings={settings}
                    onSettingsChange={setSettings}
                    onSave={() => {
                      try {
                        localStorage.setItem(
                          "peopleos-settings",
                          JSON.stringify(settings),
                        );
                        setToast("Your preferences are saved");
                      } catch {
                        setToast("Browser storage is unavailable");
                      }
                    }}
                    dark={dark}
                    onThemeChange={setDark}
                    config={config}
                    isDemo={!cloud}
                    onNavigate={navigate}
                  />
                  <AppearancePreferences />
                </>
              )}
            </>
          )}
          <footer>
            <span>{t("Made for people. Built for better work.")}</span>
            <span>
              {t("PeopleOS")}
              <span className="footer-dot">✦</span>
              {t("Your people, at the center.")}
            </span>
          </footer>
        </main>
      </div>
      <Dialog.Root
        open={!!modal}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal-content">
            <Dialog.Close
              className="modal-close icon-button"
              aria-label={t("Close dialog")}
            >
              <X size={20} />
            </Dialog.Close>
            <Dialog.Title>
              {t(
                {
                  employee: modal?.record
                    ? "Employee details"
                    : "A new face. A fresh start.",
                  request: modal?.record
                    ? "Manage time off"
                    : "A little time for yourself.",
                  job: modal?.record
                    ? "Manage position"
                    : "Find your next great hire.",
                  review: "A conversation about growth.",
                  announcement: "Keep your people in the loop.",
                  account: "Your PeopleOS account",
                  help: "A little guidance.",
                  profile: "Employee profile",
                  compliance: modal?.record
                    ? "Review compliance check"
                    : "Add a compliance check",
                  compensation: modal?.record
                    ? "Review compensation request"
                    : "Request compensation",
                  compensationDetail: "Your compensation request",
                  membership: modal?.record
                    ? "Manage workspace member"
                    : "Provision a workspace member",
                  reviewDetail: "Your performance review",
                  jobDetail: "Position details",
                  scanner: "Scan employee profile",
                  export: "Export records",
                  credentials: "Set sign-in password",
                }[modal?.type],
              )}
            </Dialog.Title>
            <Dialog.Description className="modal-description">
              {t(
                ["account", "help"].includes(modal?.type)
                  ? "Your people. Your workplace. One connected space."
                  : "All the details, in one place.",
              )}
            </Dialog.Description>
            {[
              "employee",
              "request",
              "job",
              "review",
              "announcement",
              "compensation",
              "compliance",
              "membership",
            ].includes(modal?.type) && (
              <form onSubmit={submitForm}>
                {modal.type === "employee" &&
                  (modal.record?.id ? (
                    <PhotoUploader
                      employee={modal.record}
                      isDemo={!cloud}
                      onUploaded={(url) => photoUploaded(modal.record, url)}
                    />
                  ) : (
                    <p className="profile-photo-note">
                      {t(
                        "Save the employee first, then upload a profile photo from their details.",
                      )}
                    </p>
                  ))}
                <div className="form-grid">
                  {modal.type === "employee" && (
                    <>
                      {field("Full name", "name")}
                      <label className="field">
                        {t("Employee ID")}
                        <input
                          name="employeeCode"
                          defaultValue={modal.record?.employeeCode || ""}
                          placeholder={t("Auto-generated if empty")}
                          pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
                          maxLength={32}
                        />
                      </label>
                      {field("Work email", "email", "email")}
                      {field("Job title", "role")}
                      {field("Department", "department", "text", departments)}
                      {field("Employment", "status", "text", [
                        "Full-time",
                        "Contract",
                        "On leave",
                      ])}
                      {field("Location", "location")}
                      {field("Start date", "joined", "date")}
                      {field("Annual salary (USD)", "salary", "number")}
                    </>
                  )}
                  {modal.type === "request" && (
                    <>
                      {isAdmin ? (
                        field(
                          "Employee",
                          "name",
                          "text",
                          data.employees.map((e) => e.name),
                          data.employees[0]?.name,
                        )
                      ) : (
                        <label className="field">
                          {t("Employee")}
                          <input
                            name="name"
                            value={user.name || user.email}
                            readOnly
                          />
                        </label>
                      )}
                      {field("Request type", "type", "text", [
                        "Annual leave",
                        "Sick leave",
                        "Work from home",
                        "Personal leave",
                      ])}
                      {field("From", "from", "date")}
                      {field("To", "to", "date")}
                      {field("Reason", "reason", "textarea")}
                    </>
                  )}
                  {modal.type === "job" && (
                    <>
                      {field("Job title", "title")}
                      {field("Department", "department", "text", departments)}
                      {field("Location", "location")}
                      {field("Employment type", "type", "text", [
                        "Full-time",
                        "Part-time",
                        "Contract",
                      ])}
                      {field("Position status", "status", "text", [
                        "Open",
                        "Closed",
                        "Draft",
                      ])}
                    </>
                  )}
                  {modal.type === "review" && (
                    <>
                      {field(
                        "Employee",
                        "name",
                        "text",
                        data.employees.map((e) => e.name),
                      )}
                      {field("Review cycle", "cycle", "text", null, "Q4 2026")}
                      {field("Rating", "score", "text", [
                        "1",
                        "2",
                        "3",
                        "4",
                        "4.5",
                        "4.6",
                        "4.8",
                        "5",
                      ])}
                      {field("Status", "status", "text", [
                        "In progress",
                        "Completed",
                        "Scheduled",
                      ])}
                    </>
                  )}
                  {modal.type === "compliance" && (
                    <>
                      {field("Check title", "title")}
                      {field("Category", "category", "text", [
                        "Contracts",
                        "Payroll",
                        "Policies",
                        "Benefits",
                      ])}
                      {field("Responsible person", "owner")}
                      {field("Due date", "dueDate", "date")}
                      {field("Review status", "status", "text", [
                        "In progress",
                        "Complete",
                        "Action needed",
                      ])}
                      {field("Priority", "priority", "text", [
                        "Medium",
                        "High",
                        "Low",
                      ])}
                      {field("Description", "description", "textarea")}
                    </>
                  )}
                  {modal.type === "compensation" && (
                    <>
                      {modal.record && (
                        <div className="form-full request-owner">
                          <strong>{modal.record.name}</strong>
                          <span>
                            {t("Submitted")}
                            {modal.record.submittedAt?.slice(0, 10)}
                          </span>
                        </div>
                      )}
                      {field("Request type", "type", "text", [
                        "Reimbursement",
                        "Salary adjustment",
                        "Benefit claim",
                        "Final settlement",
                      ])}
                      {field("Amount (USD)", "amount", "number")}
                      {field(
                        "Reason and supporting details",
                        "reason",
                        "textarea",
                      )}
                      {modal.record && isAdmin && (
                        <>
                          {field("Decision", "status", "text", [
                            "Pending",
                            "Approved",
                            "Declined",
                          ])}
                          {field("Review note", "reviewNote", "textarea")}
                        </>
                      )}
                    </>
                  )}
                  {modal.type === "membership" && (
                    <>
                      {field("Full name", "name")}
                      {field("Email address", "email", "email")}
                      {field("Workspace role", "role", "text", [
                        "employee",
                        "hr",
                        "admin",
                      ])}
                      {field("Access status", "status", "text", [
                        "Active",
                        "Suspended",
                      ])}
                      <p className="form-full footnote">
                        {t(
                          "After saving, open the member to set a sign-in password, or use Google with this email. The server applies role changes.",
                        )}
                      </p>
                    </>
                  )}
                  {modal.type === "announcement" && (
                    <>
                      {field("Title", "title")}
                      {field("Category", "category", "text", [
                        "Culture",
                        "Company news",
                        "Benefits",
                        "Events",
                      ])}
                      {field("Date label", "date", "text", null, "Oct 24")}
                      {field("Message", "body", "textarea")}
                    </>
                  )}
                </div>
                <div className="modal-actions">
                  {modal.record?.id &&
                    isAdmin &&
                    modal.type !== "compensation" && (
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() =>
                          setModal({
                            ...modal,
                            confirmDelete: true,
                          })
                        }
                      >
                        {t("Delete record")}
                      </button>
                    )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModal(null)}
                  >
                    {t("Cancel")}
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {t(saving ? "Saving…" : "Save")}{" "}
                    {t(modal.type === "employee" ? "employee" : "changes")}{" "}
                    <Check size={14} />
                  </Button>
                </div>
                {modal.confirmDelete && (
                  <div className="delete-confirm">
                    <p>
                      {t(
                        "Delete this record permanently? This action cannot be undone.",
                      )}
                    </p>
                    <Button
                      type="button"
                      onClick={() =>
                        save(
                          {
                            employee: "employees",
                            request: "requests",
                            job: "jobs",
                            review: "reviews",
                            announcement: "announcements",
                            compliance: "compliance",
                            compensation: "compensation",
                            membership: "memberships",
                          }[modal.type],
                          modal.record,
                          true,
                        ).then((ok) => ok && setModal(null))
                      }
                    >
                      {t("Confirm deletion")}
                    </Button>
                  </div>
                )}
              </form>
            )}
            {modal?.type === "compensationDetail" && (
              <div className="request-detail">
                <div className="request-amount">
                  ${Number(modal.record.amount).toLocaleString()}{" "}
                  <small>{t("USD")}</small>
                </div>
                <span
                  className={`workflow-status status-${modal.record.status.toLowerCase()}`}
                >
                  {modal.record.status}
                </span>
                <h3>{modal.record.type}</h3>
                <p>{modal.record.reason}</p>
                <div>
                  <strong>{t("Review note")}</strong>
                  <p>
                    {modal.record.reviewNote ||
                      "Your HR team has not added a review note yet."}
                  </p>
                </div>
              </div>
            )}
            {modal?.type === "reviewDetail" && (
              <div className="request-detail">
                <span className="request-amount">
                  {modal.record.score} <small>/ 5</small>
                </span>
                <h3>{modal.record.cycle}</h3>
                <p>{modal.record.status}</p>
                <p>{modal.record.name}</p>
              </div>
            )}
            {modal?.type === "jobDetail" && (
              <div className="request-detail">
                <h3>{modal.record.title}</h3>
                <p>
                  {modal.record.department} · {modal.record.location}
                </p>
                <p>
                  {modal.record.type} · {modal.record.status}
                </p>
              </div>
            )}
            {modal?.type === "profile" && (
              <ProfilePass
                employee={modal.record}
                workspaceId={user.workspaceId}
              />
            )}
            {modal?.type === "scanner" && (
              <ProfileScanner
                workspaceId={user.workspaceId}
                employees={data.employees}
                onSelect={openProfile}
                onClose={() => setModal(null)}
              />
            )}
            {modal?.type === "credentials" && (
              <CredentialForm
                member={modal.record}
                onCancel={() => setModal(null)}
                onSaved={() => {
                  setModal(null);
                  setToast("Sign-in password saved");
                }}
              />
            )}
            {modal?.type === "export" && (
              <ExportOptions
                resource={modal.resource}
                rows={
                  modal.resource === "employees"
                    ? employees
                    : data[modal.resource]
                }
                workspaceName={cloud ? workspace.name : settings.company}
                locale={locale}
                onClose={() => setModal(null)}
              />
            )}
            {modal?.type === "account" && (
              <div className="account-dialog">
                <Avatar
                  name={user?.name || "Alex Morgan"}
                  photoUrl={myPhoto}
                  color="green"
                />
                <span className="permission-pill">
                  {t(roleNames[user.role])}
                </span>
                <h3>{user?.name || "Alex Morgan"}</h3>
                <p>{user?.email || ""}</p>
                <span className="permission-pill">
                  <QrCode size={12} />
                  {user.memberCode ||
                    myProfile?.employeeCode ||
                    "Profile pending"}
                </span>
                {
                  <Button
                    variant="outline"
                    onClick={() => {
                      setModal(null);
                      router.push("/profile");
                    }}
                  >
                    {t("View my profile")}
                    <Users size={14} />
                  </Button>
                }
                {myProfile && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setModal({
                        type: "profile",
                        record: myProfile,
                      })
                    }
                  >
                    {t("View profile pass")}
                    <QrCode size={14} />
                  </Button>
                )}
                {user ? (
                  <Button variant="outline" onClick={logout}>
                    {t(cloud ? "Sign out" : "Back to demo roles")}{" "}
                    <LogOut size={15} />
                  </Button>
                ) : (
                  <Button
                    disabled={!config.google}
                    onClick={() => signIn("google")}
                  >
                    <Globe size={17} />
                    {t("Continue with Google")}
                  </Button>
                )}
                {!cloud && !config.google && (
                  <p className="footnote">
                    {t(
                      "Google sign in requires your OAuth client ID and secret. See the project README for setup.",
                    )}
                  </p>
                )}
                <span className="badge neutral">
                  {t(
                    cloud
                      ? "MongoDB workspace"
                      : "Local demo · saved on this browser",
                  )}
                </span>
              </div>
            )}
            {modal?.type === "help" && (
              <div className="help-content">
                <div>
                  <Users size={20} />
                  <div>
                    <strong>{t("Make your team feel at home")}</strong>
                    <p>
                      {t(
                        "Add, edit, or remove people from the employee directory. Use the menu at the end of each row.",
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <CalendarDays size={20} />
                  <div>
                    <strong>{t("A little space to recharge")}</strong>
                    <p>
                      {t(
                        "Create time off requests, then approve or decline them from the dashboard or Time off page.",
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <Globe size={20} />
                  <div>
                    <strong>{t("Connect your workplace")}</strong>
                    <p>
                      {t(
                        "Configure Google OAuth, MongoDB, and administrator emails in .env.local. The README walks through each step.",
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setModal(null);
                    navigate("Settings");
                  }}
                >
                  {t("Open workspace settings")}
                  <ArrowRight size={14} />
                </Button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="toast"
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: 10,
            }}
          >
            <span>
              <Check size={15} />
            </span>
            {t(toast)}
            <button
              className="icon-button"
              aria-label={t("Dismiss notification")}
              onClick={() => setToast("")}
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
