import { ASSET_BASE, portalRoot } from "./host";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Dropdown from "./Dropdown";
import QueryAssistantChat from "./QueryAssistantChat";
import {
  ArrowClockwise,
  ArrowLeft,
  CaretDown,
  CheckCircle,
  Database,
  DotsSixVertical,
  File,
  FileArrowUp,
  FunnelSimple,
  Globe,
  Info,
  MagnifyingGlass,
  Play,
  Plus,
  Sparkle,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";

type SourceType =
  | "database"
  | "api"
  | "file-upload"
  | "ai-model"
  | "ml-model"
  | "data-flow"
  | "marketplace"
  | "etl-flow";

export type DataSourceSummary = {
  type: string;
  name: string;
  detail: string;
};

type MlInputSource = "database" | "api" | "file-source" | "local-file";
type PickerContext = "source" | "ml";
type DatabaseType = "Fusion" | "PostgreSQL";
type DatabaseSort = "default" | "updated" | "name-asc" | "name-desc";
type SchemaTable = {
  name: string;
  columns: number;
  rows: number;
};

type DatabaseConnection = {
  id: string;
  name: string;
  description: string;
  schema: string;
  active: boolean;
};

type ApiSource = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  lastUpdated: string;
  requests: ApiRequest[];
};

type ApiMethod = "GET" | "POST";
type ApiAuth = "No Authentication" | "Bearer Token" | "Basic Auth" | "API Key";
type ApiSort = "default" | "updated" | "name-asc" | "name-desc";
type FileSort = "default" | "updated" | "name-asc" | "name-desc";
type DataFlowSort = "default" | "updated" | "name-asc" | "name-desc";

type ApiRequest = {
  id: string;
  name: string;
  method: ApiMethod;
  endpoint: string;
  description: string;
  auth: ApiAuth;
  lastUpdated: string;
};

type FileSource = {
  id: string;
  name: string;
  fileName: string;
  rows: number;
  tableName: string;
  active: boolean;
  lastUpdated: string;
};

type DataFlow = {
  id: string;
  name: string;
  description: string;
  columns: string[];
  lastUpdated: string;
};

type MarketplaceProvider = {
  id: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  lastUpdated: string;
};

type SourceTypeOption = {
  id: SourceType;
  title: string;
  description: string;
  icon: ReactNode;
};

type MlInputOption = {
  id: MlInputSource;
  title: string;
  description: string;
  icon: ReactNode;
};

const SOURCE_TYPE_ICON_BASE_URL = `${ASSET_BASE}figma/source-types`;

function SourceTypeIcon({ name, size }: { name: string; size?: number }) {
  return (
    <img
      src={`${SOURCE_TYPE_ICON_BASE_URL}/${name}.svg?v=2`}
      className={`source-type-icon source-type-icon--${name}`}
      style={size ? { width: size, height: size } : undefined}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

const DEFAULT_DATABASE_QUERY = `SELECT
    g.grid_id,
    g.longitude,
    g.latitude,
    g.area_size_km2,
    p.population_count,
    p.population_count / g.area_size_km2 AS population_density
FROM grid g
JOIN population_data p ON g.grid_id = p.grid_id
WHERE g.district_name = $district_filter
    AND p.date BETWEEN '2024-04-10 00:00:00'
    AND '2024-04-12 23:59:59'
ORDER BY population_density DESC;`;

const SOURCE_TYPES: SourceTypeOption[] = [
  {
    id: "database",
    title: "Database",
    description: "Connect to SQL, PostgreSQL, MySQL, or other databases",
    icon: <SourceTypeIcon name="database" />,
  },
  {
    id: "api",
    title: "API Request",
    description: "Connect to REST APIs, GraphQL, or web services",
    icon: <SourceTypeIcon name="api-request" />,
  },
  {
    id: "file-upload",
    title: "File",
    description: "Select from source-backed uploaded files",
    icon: <SourceTypeIcon name="file" />,
  },
  {
    id: "marketplace",
    title: "Marketplace",
    description: "Query an onboarded data marketplace provider",
    icon: <SourceTypeIcon name="marketplace" />,
  },
  {
    id: "ml-model",
    title: "ML Model",
    description: "Connect prediction APIs or upload PKL/Joblib model files",
    icon: <SourceTypeIcon name="ml-model" />,
  },
  {
    id: "etl-flow",
    title: "ETL Flow",
    description: "Use an ETL flow pipeline with transformations and analytics",
    icon: <SourceTypeIcon name="etl-flow" />,
  },
];

const MARKETPLACE_PROVIDERS: MarketplaceProvider[] = [
  {
    id: "tomtom-traffic-api",
    name: "TomTom Traffic API",
    description:
      "Road-traffic data from TomTom: live incidents and flow, junction-level delays and turn ratios",
    category: "Marketplace",
    active: true,
    lastUpdated: "8/17/2026",
  },
  {
    id: "here-traffic-api",
    name: "HERE Traffic API",
    description:
      "Real-time traffic flow, incidents, road closures, and travel-time analytics",
    category: "Marketplace",
    active: true,
    lastUpdated: "8/16/2026",
  },
  {
    id: "google-maps-platform",
    name: "Google Maps Platform",
    description:
      "Routes, places, geocoding, distance matrices, and mobility intelligence",
    category: "Marketplace",
    active: true,
    lastUpdated: "8/15/2026",
  },
  {
    id: "openweather",
    name: "OpenWeather",
    description:
      "Current weather, forecasts, historical observations, and environmental conditions",
    category: "Marketplace",
    active: true,
    lastUpdated: "8/14/2026",
  },
  {
    id: "arcgis-living-atlas",
    name: "ArcGIS Living Atlas",
    description:
      "Curated global geographic layers for demographics, land use, and infrastructure",
    category: "Marketplace",
    active: true,
    lastUpdated: "8/13/2026",
  },
  {
    id: "mapbox-traffic-data",
    name: "Mapbox Traffic Data",
    description:
      "Live road speeds, congestion patterns, routing conditions, and map-ready traffic data",
    category: "Marketplace",
    active: true,
    lastUpdated: "8/12/2026",
  },
  {
    id: "safegraph-places",
    name: "SafeGraph Places",
    description:
      "Points of interest, business attributes, brand relationships, and location metadata",
    category: "Marketplace",
    active: true,
    lastUpdated: "8/11/2026",
  },
];

const ML_INPUT_SOURCES: MlInputOption[] = [
  {
    id: "database",
    title: "Database",
    description: "PostgreSQL, Snowflake, and other SQL connections from Platform Settings",
    icon: <Database size={20} aria-hidden="true" />,
  },
  {
    id: "api",
    title: "API",
    description: "REST or GraphQL API sources, same flow as standard components",
    icon: <Globe size={20} aria-hidden="true" />,
  },
  {
    id: "file-source",
    title: "File source",
    description: "Files uploaded to Llumen and registered as queryable tables",
    icon: <File size={20} aria-hidden="true" />,
  },
];

const DATABASE_CONNECTIONS: DatabaseConnection[] = [
  { id: "itc", name: "ITC", description: "No description", schema: "fusion", active: true },
  { id: "dubai", name: "Dubai", description: "No description", schema: "Database", active: true },
  {
    id: "aimsun",
    name: "Aimsun",
    description: "Traffic management data for road network. Includes road sections with geometry and sensors.",
    schema: "Database",
    active: true,
  },
  {
    id: "energy",
    name: "Energy",
    description: "UAE Energy & Sustainability Operations",
    schema: "Database",
    active: true,
  },
  { id: "itc-pg", name: "ITC PG", description: "No description", schema: "Database", active: true },
  {
    id: "itc-fusion",
    name: "ITC Fusion DB",
    description: "No description",
    schema: "Database",
    active: true,
  },
  { id: "waste", name: "Waste", description: "UAE Waste Data", schema: "Database", active: true },
  {
    id: "itc-postgres",
    name: "ITC - Postgres",
    description: "No description",
    schema: "Database",
    active: true,
  },
  {
    id: "security",
    name: "Security",
    description: "UAE Safety & Security Data",
    schema: "Database",
    active: true,
  },
  {
    id: "employees",
    name: "Employees",
    description: "Sample Employee Database",
    schema: "Database",
    active: true,
  },
  {
    id: "commerce",
    name: "Commerce",
    description: "Sample Retail & Fulfillment Operations Data",
    schema: "Database",
    active: true,
  },
];

const DATABASE_TYPES: DatabaseType[] = ["Fusion", "PostgreSQL"];
const DATABASE_CONNECTION_META: Record<
  string,
  { type: DatabaseType; lastUpdated: string; updatedMinutes: number }
> = {
  itc: { type: "Fusion", lastUpdated: "8/17/2026", updatedMinutes: 60 },
  dubai: { type: "PostgreSQL", lastUpdated: "8/11/2026", updatedMinutes: 180 },
  aimsun: { type: "PostgreSQL", lastUpdated: "8/11/2026", updatedMinutes: 360 },
  energy: { type: "PostgreSQL", lastUpdated: "8/16/2026", updatedMinutes: 120 },
  "itc-pg": { type: "PostgreSQL", lastUpdated: "8/17/2026", updatedMinutes: 30 },
  "itc-fusion": { type: "Fusion", lastUpdated: "8/12/2026", updatedMinutes: 300 },
  waste: { type: "PostgreSQL", lastUpdated: "8/17/2026", updatedMinutes: 45 },
  "itc-postgres": { type: "PostgreSQL", lastUpdated: "8/13/2026", updatedMinutes: 240 },
  security: { type: "PostgreSQL", lastUpdated: "8/16/2026", updatedMinutes: 120 },
  employees: { type: "PostgreSQL", lastUpdated: "8/11/2026", updatedMinutes: 1440 },
  commerce: { type: "PostgreSQL", lastUpdated: "8/11/2026", updatedMinutes: 1440 },
};

const SCHEMA_TABLES: SchemaTable[] = [
  { name: "dim_emirate", columns: 6, rows: 7 },
  { name: "dim_facility", columns: 11, rows: 660 },
  { name: "dim_pollution_source", columns: 4, rows: 3 },
  { name: "dim_sector", columns: 6, rows: 3 },
  { name: "dim_violation_type", columns: 5, rows: 3 },
  { name: "dim_zone", columns: 8, rows: 197 },
  { name: "fact_consumption", columns: 7, rows: 319731 },
  { name: "fact_emission", columns: 9, rows: 106577 },
  { name: "fact_zone_load", columns: 8, rows: 106577 },
  { name: "fact_inspection", columns: 10, rows: 17500 },
  { name: "fact_grid_event", columns: 8, rows: 8020 },
  { name: "fact_asset_status", columns: 7, rows: 5240 },
  { name: "fact_daily_summary", columns: 12, rows: 1946 },
];

const SCHEMA_COLUMNS = [
  ["emirate_id", "smallint", "No", "—", "Yes"],
  ["name", "text", "No", "—", "No"],
  ["area_km2", "numeric", "No", "—", "No"],
  ["population", "integer", "No", "—", "No"],
  ["centroid", "USER-DEFINED", "No", "—", "No"],
  ["geometry", "USER-DEFINED", "No", "—", "No"],
];

const API_SOURCES: ApiSource[] = [
  {
    id: "weather-services",
    name: "Weather Services",
    description: "Real-time weather data and forecasts",
    active: true,
    lastUpdated: "2 hours ago",
    requests: [
      {
        id: "get-current-weather",
        name: "Get Current Weather",
        method: "GET",
        endpoint: "https://api.weather.example.com/v1/current",
        description: "Retrieve current weather conditions",
        auth: "API Key",
        lastUpdated: "1 hour ago",
      },
      {
        id: "get-weather-forecast",
        name: "Get Weather Forecast",
        method: "POST",
        endpoint: "https://api.weather.example.com/v1/forecast",
        description: "Get 7-day weather forecast for location",
        auth: "No Authentication",
        lastUpdated: "45 mins ago",
      },
    ],
  },
  {
    id: "traffic-services",
    name: "Traffic Services",
    description: "Real-time traffic data and route optimization",
    active: true,
    lastUpdated: "1 day ago",
    requests: [
      {
        id: "get-traffic-flow",
        name: "Get Traffic Flow",
        method: "POST",
        endpoint: "https://api.traffic.example.com/v1/flow",
        description: "Retrieve real-time traffic flow data",
        auth: "Bearer Token",
        lastUpdated: "3 hours ago",
      },
    ],
  },
  {
    id: "customer-services",
    name: "Customer Services",
    description: "Customer data and account management",
    active: true,
    lastUpdated: "4 hours ago",
    requests: [
      {
        id: "customer-portal-api",
        name: "Customer Portal API",
        method: "GET",
        endpoint: "https://api.customer.example.com/v1/accounts",
        description: "Internal customer data and account information",
        auth: "Bearer Token",
        lastUpdated: "2 hours ago",
      },
      {
        id: "hr-system-api",
        name: "HR System API",
        method: "GET",
        endpoint: "https://api.hr.example.com/v1/employees",
        description: "Employee data and organizational structure",
        auth: "Basic Auth",
        lastUpdated: "1 day ago",
      },
    ],
  },
  {
    id: "business-services",
    name: "Business Services",
    description: "Business operations and reporting",
    active: true,
    lastUpdated: "6 hours ago",
    requests: [
      {
        id: "inventory-management-api",
        name: "Inventory Management API",
        method: "POST",
        endpoint: "https://api.business.example.com/v1/inventory",
        description: "Real-time inventory tracking and stock management",
        auth: "Bearer Token",
        lastUpdated: "30 mins ago",
      },
      {
        id: "financial-reporting-api",
        name: "Financial Reporting API",
        method: "GET",
        endpoint: "https://api.business.example.com/v1/financial-reports",
        description: "Financial data and reporting metrics",
        auth: "API Key",
        lastUpdated: "1 hour ago",
      },
    ],
  },
];

const API_AUTH_OPTIONS: ApiAuth[] = [
  "No Authentication",
  "Bearer Token",
  "Basic Auth",
  "API Key",
];
const API_METHOD_OPTIONS: ApiMethod[] = ["GET", "POST"];
const API_SORT_LABELS: Record<ApiSort, string> = {
  default: "Default",
  updated: "Last Tested",
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
};
const FILE_SORT_LABELS: Record<FileSort, string> = {
  default: "Default",
  updated: "Last Tested",
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
};
const DATA_FLOW_SORT_LABELS: Record<DataFlowSort, string> = {
  default: "Default",
  updated: "Last Updated",
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
};

function relativeTimeMinutes(value: string) {
  const amount = Number.parseInt(value, 10);
  if (value.includes("min")) return amount;
  if (value.includes("hour")) return amount * 60;
  if (value.includes("day")) return amount * 1440;
  return Number.MAX_SAFE_INTEGER;
}

const FILE_SOURCES: FileSource[] = [
  {
    id: "forecast-results",
    name: "Forecast_results_20260513new",
    fileName: "Forecast_results_20260513.db",
    rows: 15940,
    tableName: "ds_5cccff50c4644f7b5068a48711efe4e__results",
    active: true,
    lastUpdated: "8/17/2026",
  },
  {
    id: "sultan-workflow-1",
    name: "Sultan Bin Zayed The First Street ridership trend chart (workflow run 1)",
    fileName: "Sultan_Bin_Zayed_The_First_Street_ridership_trend_chart_workflow_run_4103ee14.parquet",
    rows: 21,
    tableName: "ds_d0b8d812bd040be9573ada2db652221",
    active: true,
    lastUpdated: "8/11/2026",
  },
  {
    id: "sultan-workflow-2",
    name: "Sultan Bin Zayed The First Street ridership trend chart (workflow run 2)",
    fileName: "Sultan_Bin_Zayed_The_First_Street_ridership_trend_chart_workflow_run_5be66496.parquet",
    rows: 21,
    tableName: "ds_5ae68eef3f184554810c382be0a6d394",
    active: true,
    lastUpdated: "8/11/2026",
  },
  {
    id: "capacity-region",
    name: "2050 Capacity by Region",
    fileName: "2050_Capacity_by_Region.parquet",
    rows: 18,
    tableName: "ds_288a25da839945228c93b8674181d1a8",
    active: true,
    lastUpdated: "8/11/2026",
  },
  {
    id: "capacity-trajectory",
    name: "Abu Dhabi Capacity Trajectory to 2050",
    fileName: "Abu_Dhabi_Capacity_Trajectory_to_2050.parquet",
    rows: 18,
    tableName: "ds_e39d26283ab647839634e0bb225fe507",
    active: true,
    lastUpdated: "8/11/2026",
  },
  {
    id: "workflow-asset-1",
    name: "Workflow Asset",
    fileName: "Workflow_Asset.parquet",
    rows: 26,
    tableName: "ds_70bf6e1c09eb42179ba6376650178f8e",
    active: true,
    lastUpdated: "8/11/2026",
  },
  {
    id: "workflow-asset-2",
    name: "Workflow Asset",
    fileName: "Hamdan_Bin_Mohammed_Street_Weekly_Trips_In.parquet",
    rows: 26,
    tableName: "ds_3633efaf71da4ec88df18de7454f3c22",
    active: true,
    lastUpdated: "8/11/2026",
  },
  {
    id: "wind-hour",
    name: "wind_hour_06",
    fileName: "wind_hour_06.geojson",
    rows: 1024,
    tableName: "ds_378739805bf04501932b2ff632cdd153",
    active: true,
    lastUpdated: "8/11/2026",
  },
  {
    id: "climatology",
    name: "CLIMATOLOGY_SERIES_EAD_WRF_20260406_20260408_d01",
    fileName: "CLIMATOLOGY_SERIES_EAD_WRF_20260406_20260408_d01.csv",
    rows: 4,
    tableName: "ds_900907603ae14ce09b4398d222c035e4",
    active: true,
    lastUpdated: "8/11/2026",
  },
];

const DATA_FLOWS: DataFlow[] = [
  {
    id: "untitled-etl-flow",
    name: "Untitled ETL Flow",
    description: "No description",
    columns: ["id", "source", "transformed_value", "status", "updated_at"],
    lastUpdated: "8/17/2026",
  },
  {
    id: "incident",
    name: "incident",
    description: "No description",
    columns: [
      "coords",
      "description",
      "end_time",
      "id",
      "in_simulation",
      "incident_type",
      "name",
      "section_id",
      "start_time",
      "id_1",
      "name_1",
    ],
    lastUpdated: "8/16/2026",
  },
  {
    id: "untitled-data-flow-1",
    name: "Untitled DataFlow",
    description: "No description",
    columns: ["id", "name", "value", "category", "created_at", "updated_at"],
    lastUpdated: "8/12/2026",
  },
  {
    id: "untitled-data-flow-2",
    name: "Untitled DataFlow",
    description: "No description",
    columns: ["id", "source", "status", "result", "timestamp"],
    lastUpdated: "8/11/2026",
  },
];

function FieldHeader({
  title,
  required = true,
  action,
}: {
  title: string;
  required?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="ds-config__header">
      <h3>{title}</h3>
      {(required || action) && (
        <div className="ds-config__header-actions">
          {required && (
            <span className="ds-config__required">
              <Info size={16} aria-hidden="true" />
              Required
            </span>
          )}
          {action}
        </div>
      )}
    </div>
  );
}

function SourceActionField({
  label,
  icon,
  description,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  description?: string;
  onClick?: () => void;
}) {
  return (
    <>
      <button type="button" className="ds-config__action" onClick={onClick}>
        <span className="ds-config__action-icon">{icon}</span>
        <span>{label}</span>
      </button>
      {description && <p className="ds-config__helper">{description}</p>}
    </>
  );
}

function LocalFileUpload({
  variant = "ml",
  onFileChange,
}: {
  variant?: "ml" | "source";
  onFileChange?: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const selectFile = (nextFile: File | null) => {
    setFile(nextFile);
    onFileChange?.(nextFile);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files[0];
    if (nextFile) selectFile(nextFile);
  };

  return (
    <label
      className={
        "ds-local-file-upload" +
        (variant === "source" ? " ds-local-file-upload--source" : "") +
        (dragging ? " is-dragging" : "")
      }
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".csv,.json,.geojson,application/json,text/csv,application/geo+json"
        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
      />
      {variant === "source" ? (
        <>
          <FileArrowUp size={24} aria-hidden="true" />
          <strong>{file?.name ?? "Drag and drop your file here, or"}</strong>
          <span className="ds-local-file-upload__select">
            <Plus size={18} aria-hidden="true" />
            Select File
          </span>
          <span className="ds-local-file-upload__limit">
            {file
              ? `${Math.max(1, Math.round(file.size / 1024))} KB`
              : "Maximum file size: 20MB"}
          </span>
        </>
      ) : (
        <>
          <UploadSimple size={30} aria-hidden="true" />
          <strong>{file?.name ?? "Click to upload"}</strong>
          <span>
            {file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "CSV, JSON, or GeoJSON"}
          </span>
        </>
      )}
    </label>
  );
}

function UploadFileModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <section className="ds-upload-file-modal">
      <header>
        <h2>Upload New File</h2>
        <button type="button" aria-label="Close upload modal" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="ds-upload-file-modal__body">
        <LocalFileUpload variant="source" onFileChange={setFile} />
      </div>
      <footer>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" disabled={!file} onClick={onClose}>
          Upload File
        </button>
      </footer>
    </section>
  );
}

function CreateDatabaseConnectionForm({ onClose }: { onClose: () => void }) {
  const [connectionName, setConnectionName] = useState("");
  const [databaseType, setDatabaseType] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3306");
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const canCreate =
    connectionName.trim() &&
    databaseType &&
    host.trim() &&
    port.trim() &&
    databaseName.trim() &&
    username.trim() &&
    password;

  return (
    <form
      className="ds-create-db"
      onSubmit={(event) => {
        event.preventDefault();
        if (canCreate) onClose();
      }}
    >
      <header className="ds-create-db__header">
        <h2>Create Database Connection</h2>
        <button type="button" aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="ds-create-db__fields">
        <label>
          <span>
            Connection Name <i>*</i>
          </span>
      <input
            value={connectionName}
            onChange={(event) => setConnectionName(event.target.value)}
            placeholder="Enter connection name"
            autoFocus
          />
        </label>

        <label>
          <span>
            Database Type <i>*</i>
          </span>
          <Dropdown
            value={databaseType}
            onChange={setDatabaseType}
            options={DATABASE_TYPES.map((type) => ({ value: type, label: type }))}
            placeholder="Select database type"
            ariaLabel="Database type"
            compact
          />
        </label>

        <label>
          <span>
            Host <i>*</i>
          </span>
          <input
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder="localhost"
          />
        </label>

        <label>
          <span>
            Port <i>*</i>
          </span>
          <input
            value={port}
            onChange={(event) => setPort(event.target.value)}
            placeholder="3306"
            inputMode="numeric"
          />
        </label>

        <label>
          <span>
            Database Name <i>*</i>
          </span>
          <input
            value={databaseName}
            onChange={(event) => setDatabaseName(event.target.value)}
            placeholder="Enter database name"
          />
        </label>

        <label>
          <span>
            Username <i>*</i>
          </span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            autoComplete="username"
          />
        </label>

        <label>
          <span>
            Password <i>*</i>
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="new-password"
          />
        </label>
    </div>

      <footer className="ds-create-db__footer">
        <button type="button" className="ds-create-db__cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="ds-create-db__submit" disabled={!canCreate}>
          Create Connection
        </button>
      </footer>
    </form>
  );
}

function DatabaseConnectionPicker({
  selectedId,
  onChange,
  onCancel,
  onSelect,
}: {
  selectedId: string | null;
  onChange: (id: string) => void;
  onCancel: () => void;
  onSelect: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<DatabaseType[]>([]);
  const [sort, setSort] = useState<DatabaseSort>("default");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const filteredConnections = DATABASE_CONNECTIONS.filter((connection) => {
    const meta = DATABASE_CONNECTION_META[connection.id];
    const matchesSearch = `${connection.name} ${connection.description} ${connection.schema} ${meta.type}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(meta.type);
    return matchesSearch && matchesType;
  });
  const visibleConnections = [...filteredConnections].sort((left, right) => {
    if (sort === "updated") {
  return (
        DATABASE_CONNECTION_META[left.id].updatedMinutes -
        DATABASE_CONNECTION_META[right.id].updatedMinutes
      );
    }
    if (sort === "name-asc") return left.name.localeCompare(right.name);
    if (sort === "name-desc") return right.name.localeCompare(left.name);
    return 0;
  });
  const canSelectConnection = DATABASE_CONNECTIONS.some(
    (connection) => connection.id === selectedId && connection.active,
  );
  const sortLabel: Record<DatabaseSort, string> = {
    default: "Default",
    updated: "Last Tested",
    "name-asc": "Name (A-Z)",
    "name-desc": "Name (Z-A)",
  };

  const toggleType = (type: DatabaseType) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  return (
    <>
      <section className="ds-db-manager">
      <header className="ds-db-manager__titlebar">
        <h2>Select Database Connection</h2>
        <button type="button" aria-label="Close" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
      </button>
      </header>

      <div className="ds-db-manager__toolbar">
        <h3>Database Connections</h3>
        <div className="ds-db-manager__toolbar-actions">
          <label className="ds-db-manager__search">
            <MagnifyingGlass size={17} aria-hidden="true" />
      <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search connections..."
            />
          </label>
          <button
            type="button"
            className="ds-db-manager__new"
            disabled
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={17} aria-hidden="true" />
            New Connection
          </button>
          </div>
        </div>

      <div className="ds-db-manager__filters">
        <div className="ds-db-manager__menu-wrap">
          <button
            type="button"
            className={typeMenuOpen ? "is-open" : ""}
            aria-expanded={typeMenuOpen}
            aria-haspopup="menu"
            onClick={() => {
              setTypeMenuOpen((open) => !open);
              setSortMenuOpen(false);
            }}
          >
            Type{selectedTypes.length ? ` (${selectedTypes.length})` : ""}
            <CaretDown size={15} aria-hidden="true" />
          </button>
          {typeMenuOpen && (
            <div className="ds-db-manager__menu ds-db-manager__type-menu" role="menu">
              <div className="dropdown-menu__inner">
                {DATABASE_TYPES.map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() => toggleType(type)}
                    />
                    <span aria-hidden="true" />
                    {type}
                  </label>
                ))}
      </div>
            </div>
          )}
        </div>

        <div className="ds-db-manager__menu-wrap">
          <button
            type="button"
            className={sortMenuOpen ? "is-open" : ""}
            aria-expanded={sortMenuOpen}
            aria-haspopup="menu"
            onClick={() => {
              setSortMenuOpen((open) => !open);
              setTypeMenuOpen(false);
            }}
          >
            <FunnelSimple size={15} aria-hidden="true" />
            {sortLabel[sort]}
            <CaretDown size={15} aria-hidden="true" />
      </button>
          {sortMenuOpen && (
            <div className="ds-db-manager__menu ds-db-manager__sort-menu" role="menu">
              <div className="dropdown-menu__inner">
                {(Object.entries(sortLabel) as [DatabaseSort, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={sort === value ? "is-selected" : ""}
                    role="menuitem"
                    onClick={() => {
                      setSort(value);
                      setSortMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ds-db-manager__columns" aria-hidden="true">
        <span>Database Connections</span>
        <span>Last Tested</span>
      </div>

      <div className="ds-db-manager__list" role="listbox" aria-label="Database connections">
        {visibleConnections.map((connection) => {
          const selected = connection.active && selectedId === connection.id;
          const meta = DATABASE_CONNECTION_META[connection.id];
          return (
            <div
              key={connection.id}
              role="option"
              tabIndex={connection.active ? 0 : -1}
              aria-selected={selected}
              aria-disabled={!connection.active}
              className={
                "ds-db-manager-row" +
                (selected ? " is-selected" : "") +
                (!connection.active ? " is-disabled" : "")
              }
              onClick={() => {
                if (connection.active) onChange(connection.id);
              }}
              onKeyDown={(event) => {
                if (
                  connection.active &&
                  event.currentTarget === event.target &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onChange(connection.id);
                }
              }}
            >
              <div className="ds-db-manager-row__connection">
                <strong>{connection.name}</strong>
                {connection.description.trim().toLowerCase() !== "no description" && (
                  <div>
                    <span>{connection.description}</span>
                  </div>
                )}
              </div>
              <span className="ds-db-manager-row__actions">
                <time className="ds-db-manager-row__updated">{meta.lastUpdated}</time>
                <button
                  type="button"
                  aria-label={`Information about ${connection.name}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Info size={20} aria-hidden="true" />
                </button>
              </span>
    </div>
          );
        })}
        {visibleConnections.length === 0 && (
          <p className="ds-db-manager__empty">No database connections match your search.</p>
        )}
      </div>

      <footer className="ds-db-manager__footer">
        <button type="button" className="ds-db-manager__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="ds-db-manager__select"
          disabled={!canSelectConnection}
          onClick={onSelect}
        >
          Select Connection
        </button>
      </footer>
    </section>
      {createModalOpen && (
        <SourcePickerModal variant="create-database" onClose={() => setCreateModalOpen(false)}>
          <CreateDatabaseConnectionForm onClose={() => setCreateModalOpen(false)} />
        </SourcePickerModal>
      )}
    </>
  );
}

function CreateApiCollectionForm({ onClose }: { onClose: () => void }) {
  const [connectionName, setConnectionName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [authenticationMethod, setAuthenticationMethod] =
    useState<ApiAuth>("No Authentication");
  const [requestMethod, setRequestMethod] = useState<ApiMethod>("GET");
  const canCreate = connectionName.trim() && apiUrl.trim();

  return (
    <form
      className="ds-create-db ds-create-api"
      onSubmit={(event) => {
        event.preventDefault();
        if (canCreate) onClose();
      }}
    >
      <header className="ds-create-db__header">
        <h2>Create API Collection</h2>
        <button type="button" aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="ds-create-db__fields">
        <label>
          <span>
            Connection Name <i>*</i>
          </span>
          <input
            value={connectionName}
            onChange={(event) => setConnectionName(event.target.value)}
            placeholder="Enter connection name"
            autoFocus
          />
        </label>

        <label>
          <span>
            API URL <i>*</i>
          </span>
          <input
            type="url"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder="https://api.example.com/data"
          />
        </label>

        <label>
          <span>Authentication Method</span>
          <Dropdown
            value={authenticationMethod}
            onChange={(value) => setAuthenticationMethod(value as ApiAuth)}
            options={API_AUTH_OPTIONS.map((method) => ({ value: method, label: method }))}
            ariaLabel="Authentication method"
            compact
          />
        </label>

        <label>
          <span>Request Method</span>
          <Dropdown
            value={requestMethod}
            onChange={(value) => setRequestMethod(value as ApiMethod)}
            options={API_METHOD_OPTIONS.map((method) => ({ value: method, label: method }))}
            ariaLabel="Request method"
            compact
          />
        </label>
      </div>

      <footer className="ds-create-db__footer">
        <button type="button" className="ds-create-db__cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="ds-create-db__submit" disabled={!canCreate}>
          Create Connection
        </button>
      </footer>
    </form>
  );
}

function ApiSourcePicker({
  selectedId,
  selectedRequestId,
  onChange,
  onCancel,
  onSelect,
}: {
  selectedId: string | null;
  selectedRequestId: string;
  onChange: (collectionId: string, requestId: string) => void;
  onCancel: () => void;
  onSelect: () => void;
}) {
  const [search, setSearch] = useState("");
  const [openCollections, setOpenCollections] = useState<Set<string>>(() => new Set());
  const [loadingCollections, setLoadingCollections] = useState<Set<string>>(() => new Set());
  const loadingTimers = useRef<Map<string, number>>(new Map());
  const [selectedAuths, setSelectedAuths] = useState<ApiAuth[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<ApiMethod[]>([]);
  const [sort, setSort] = useState<ApiSort>("default");
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [methodMenuOpen, setMethodMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const selectedCollection = API_SOURCES.find((collection) => collection.id === selectedId);
  const canSelectRequest = Boolean(
    selectedCollection?.active &&
      selectedCollection.requests.some((request) => request.id === selectedRequestId),
  );
  const searchValue = search.trim().toLowerCase();
  const hasRequestFilters = selectedAuths.length > 0 || selectedMethods.length > 0;
  const compareItems = (
    left: { name: string; lastUpdated: string },
    right: { name: string; lastUpdated: string },
  ) => {
    if (sort === "updated") {
      return relativeTimeMinutes(left.lastUpdated) - relativeTimeMinutes(right.lastUpdated);
    }
    if (sort === "name-asc") return left.name.localeCompare(right.name);
    if (sort === "name-desc") return right.name.localeCompare(left.name);
    return 0;
  };
  const filteredCollections = API_SOURCES.map((collection) => {
    const collectionMatchesSearch =
      !searchValue ||
      `${collection.name} ${collection.description}`.toLowerCase().includes(searchValue);
    const requests = collection.requests
      .filter((request) => {
        const requestMatchesSearch =
          !searchValue ||
          collectionMatchesSearch ||
          `${request.name} ${request.description} ${request.method} ${request.auth}`
            .toLowerCase()
            .includes(searchValue);
        const matchesAuth =
          selectedAuths.length === 0 || selectedAuths.includes(request.auth);
        const matchesMethod =
          selectedMethods.length === 0 || selectedMethods.includes(request.method);
        return requestMatchesSearch && matchesAuth && matchesMethod;
      })
      .sort(compareItems);
    return { ...collection, requests, collectionMatchesSearch };
  })
    .filter(
      (collection) =>
        collection.requests.length > 0 ||
        (!hasRequestFilters && collection.collectionMatchesSearch),
    )
    .sort(compareItems);

  const toggleAuth = (auth: ApiAuth) => {
    setSelectedAuths((current) =>
      current.includes(auth) ? current.filter((item) => item !== auth) : [...current, auth],
    );
  };
  const toggleMethod = (method: ApiMethod) => {
    setSelectedMethods((current) =>
      current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method],
    );
  };

  useEffect(
    () => () => {
      loadingTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const toggleCollection = (id: string) => {
    const isOpen = openCollections.has(id);
    setOpenCollections((current) => {
      const next = new Set(current);
      if (isOpen) next.delete(id);
      else next.add(id);
      return next;
    });

    const existingTimer = loadingTimers.current.get(id);
    if (existingTimer) window.clearTimeout(existingTimer);

    if (isOpen) {
      loadingTimers.current.delete(id);
      setLoadingCollections((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }

    setLoadingCollections((current) => new Set(current).add(id));
    loadingTimers.current.set(
      id,
      window.setTimeout(() => {
        setLoadingCollections((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        loadingTimers.current.delete(id);
      }, 1600),
    );
  };

  return (
    <>
      <section className="ds-api-manager">
      <header className="ds-db-manager__titlebar">
        <h2>Select API Request</h2>
        <button type="button" aria-label="Close" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
          </button>
      </header>

      <div className="ds-db-manager__toolbar">
        <h3>API Collections &amp; Requests</h3>
        <div className="ds-db-manager__toolbar-actions">
          <label className="ds-db-manager__search ds-api-manager__search">
            <MagnifyingGlass size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search collections and requests..."
            />
          </label>
          <button
            type="button"
            className="ds-db-manager__new"
            disabled
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={17} aria-hidden="true" />
            New Collection
          </button>
          </div>
        </div>

      <div className="ds-db-manager__filters">
        <div className="ds-api-manager__filter-group">
          <div className="ds-db-manager__menu-wrap">
            <button
              type="button"
              className={authMenuOpen ? "is-open" : ""}
              aria-expanded={authMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setAuthMenuOpen((open) => !open);
                setMethodMenuOpen(false);
                setSortMenuOpen(false);
              }}
            >
              Auth{selectedAuths.length ? ` (${selectedAuths.length})` : ""}
              <CaretDown size={15} aria-hidden="true" />
            </button>
            {authMenuOpen && (
              <div
                className="ds-db-manager__menu ds-db-manager__type-menu ds-api-manager__auth-menu"
                role="menu"
              >
                <div className="dropdown-menu__inner">
                  {API_AUTH_OPTIONS.map((auth) => (
                    <label key={auth}>
                      <input
                        type="checkbox"
                        checked={selectedAuths.includes(auth)}
                        onChange={() => toggleAuth(auth)}
                      />
                      <span aria-hidden="true" />
                      {auth}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ds-db-manager__menu-wrap">
            <button
              type="button"
              className={methodMenuOpen ? "is-open" : ""}
              aria-expanded={methodMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setMethodMenuOpen((open) => !open);
                setAuthMenuOpen(false);
                setSortMenuOpen(false);
              }}
            >
              Method{selectedMethods.length ? ` (${selectedMethods.length})` : ""}
              <CaretDown size={15} aria-hidden="true" />
            </button>
            {methodMenuOpen && (
              <div
                className="ds-db-manager__menu ds-db-manager__type-menu ds-api-manager__method-menu"
                role="menu"
              >
                <div className="dropdown-menu__inner">
                  {API_METHOD_OPTIONS.map((method) => (
                    <label key={method}>
                      <input
                        type="checkbox"
                        checked={selectedMethods.includes(method)}
                        onChange={() => toggleMethod(method)}
                      />
                      <span aria-hidden="true" />
                      {method}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ds-db-manager__menu-wrap">
          <button
            type="button"
            className={sortMenuOpen ? "is-open" : ""}
            aria-expanded={sortMenuOpen}
            aria-haspopup="menu"
            onClick={() => {
              setSortMenuOpen((open) => !open);
              setAuthMenuOpen(false);
              setMethodMenuOpen(false);
            }}
          >
            <FunnelSimple size={15} aria-hidden="true" />
            {API_SORT_LABELS[sort]}
            <CaretDown size={15} aria-hidden="true" />
          </button>
          {sortMenuOpen && (
            <div className="ds-db-manager__menu ds-db-manager__sort-menu" role="menu">
              <div className="dropdown-menu__inner">
                {(Object.entries(API_SORT_LABELS) as [ApiSort, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={sort === value ? "is-selected" : ""}
                    role="menuitem"
                    onClick={() => {
                      setSort(value);
                      setSortMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ds-api-manager__columns" aria-hidden="true">
        <span>API Collections &amp; Requests</span>
        <span>Last Tested</span>
        <span />
      </div>

      <div className="ds-api-manager__list" role="listbox" aria-label="API requests">
        {filteredCollections.map((collection) => {
          const open = openCollections.has(collection.id);
          const loading = loadingCollections.has(collection.id);
          return (
            <div
              className="ds-api-collection"
              key={collection.id}
              aria-busy={open && loading}
            >
              <div
                className={
                  "ds-api-collection__row" + (!collection.active ? " is-disabled" : "")
                }
                role="button"
                tabIndex={collection.active ? 0 : -1}
                aria-expanded={open}
                aria-disabled={!collection.active}
                onClick={() => {
                  if (collection.active) toggleCollection(collection.id);
                }}
                onKeyDown={(event) => {
                  if (
                    collection.active &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    toggleCollection(collection.id);
                  }
                }}
              >
                <CaretDown
                  className={"ds-api-collection__caret" + (open ? " is-open" : "")}
                  size={16}
                  aria-hidden="true"
                />
                <span className="ds-api-collection__content">
                  <strong>{collection.name}</strong>
                  <small>{collection.description}</small>
                </span>
                <time>{collection.lastUpdated}</time>
                <span className="ds-api-manager__view">
                  <Info size={20} aria-hidden="true" />
                </span>
              </div>
              {open &&
                (loading ? (
                  <div
                    className="ds-api-request-skeleton-list"
                    aria-label="Loading API requests"
                  >
                    {Array.from(
                      { length: Math.max(2, Math.min(collection.requests.length, 4)) },
                      (_, index) => (
                        <div className="ds-api-request-skeleton" key={index} aria-hidden="true">
                          <span className="ds-api-request-skeleton__content">
                            <i />
                            <i />
                          </span>
                          <i className="ds-api-request-skeleton__updated" />
                          <i className="ds-api-request-skeleton__action" />
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  collection.requests.map((request) => {
                  const selected =
                    collection.active &&
                    selectedId === collection.id &&
                    selectedRequestId === request.id;
                  return (
                    <button
                      key={request.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={!collection.active}
                      className={"ds-api-request-row" + (selected ? " is-selected" : "")}
                      onClick={() => onChange(collection.id, request.id)}
                    >
                      <span className="ds-api-request-row__content">
                        <strong>{request.name}</strong>
                        <span>
                          <small>{request.method}</small>
                          {request.description}
                        </span>
                      </span>
                      <time>{request.lastUpdated}</time>
                      <span className="ds-api-manager__view">
                        <Info size={20} aria-hidden="true" />
                      </span>
                    </button>
                  );
                  })
                ))}
            </div>
          );
        })}
        {filteredCollections.length === 0 && (
          <p className="ds-db-manager__empty">No API collections match your search.</p>
        )}
      </div>

      <footer className="ds-db-manager__footer">
        <button type="button" className="ds-db-manager__cancel" onClick={onCancel}>
          Cancel
            </button>
        <button
          type="button"
          className="ds-db-manager__select"
          disabled={!canSelectRequest}
          onClick={onSelect}
        >
          Select Request
            </button>
      </footer>
      </section>
      {createModalOpen && (
        <SourcePickerModal variant="create-api" onClose={() => setCreateModalOpen(false)}>
          <CreateApiCollectionForm onClose={() => setCreateModalOpen(false)} />
        </SourcePickerModal>
      )}
    </>
  );
}

function MarketplaceProviderPicker({
  selectedId,
  onChange,
  onCancel,
  onSelect,
}: {
  selectedId: string | null;
  onChange: (id: string) => void;
  onCancel: () => void;
  onSelect: () => void;
}) {
  const [search, setSearch] = useState("");
  const visibleProviders = MARKETPLACE_PROVIDERS.filter((provider) =>
    `${provider.name} ${provider.description} ${provider.category}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const canSelectProvider = MARKETPLACE_PROVIDERS.some(
    (provider) => provider.id === selectedId && provider.active,
  );

  return (
    <section className="ds-db-manager ds-marketplace-manager">
      <header className="ds-db-manager__titlebar">
        <h2>Select Marketplace Provider</h2>
        <button type="button" aria-label="Close" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="ds-db-manager__toolbar">
        <h3>Marketplace Providers</h3>
        <div className="ds-db-manager__toolbar-actions">
          <label className="ds-db-manager__search">
            <MagnifyingGlass size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search marketplace providers..."
            />
          </label>
        </div>
      </div>

      <div className="ds-db-manager__columns" aria-hidden="true">
        <span>Marketplace Providers</span>
        <span>Last Updated</span>
      </div>

      <div
        className="ds-db-manager__list"
        role="listbox"
        aria-label="Marketplace providers"
      >
        {visibleProviders.map((provider) => {
          const selected = provider.active && selectedId === provider.id;
          return (
            <div
              key={provider.id}
              role="option"
              tabIndex={provider.active ? 0 : -1}
              aria-selected={selected}
              aria-disabled={!provider.active}
              className={
                "ds-db-manager-row" +
                (selected ? " is-selected" : "") +
                (!provider.active ? " is-disabled" : "")
              }
              onClick={() => {
                if (provider.active) onChange(provider.id);
              }}
              onKeyDown={(event) => {
                if (
                  provider.active &&
                  event.currentTarget === event.target &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onChange(provider.id);
                }
              }}
            >
              <div className="ds-db-manager-row__connection">
                <strong>{provider.name}</strong>
                <div>
                  <span>{provider.description}</span>
                  <span>{provider.category}</span>
                </div>
              </div>
              <span className="ds-db-manager-row__actions">
                <time className="ds-db-manager-row__updated">{provider.lastUpdated}</time>
                <button
                  type="button"
                  aria-label={`Information about ${provider.name}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Info size={20} aria-hidden="true" />
                </button>
              </span>
            </div>
          );
        })}
        {visibleProviders.length === 0 && (
          <p className="ds-db-manager__empty">No marketplace providers match your search.</p>
        )}
      </div>

      <footer className="ds-db-manager__footer">
        <button type="button" className="ds-db-manager__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="ds-db-manager__select"
          disabled={!canSelectProvider}
          onClick={onSelect}
        >
          Select Provider
        </button>
      </footer>
    </section>
  );
}

function FileSourcePicker({
  selectedId,
  onChange,
  onCancel,
  onSelect,
  onUploadNewFile,
}: {
  selectedId: string | null;
  onChange: (id: string) => void;
  onCancel: () => void;
  onSelect: () => void;
  onUploadNewFile: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<FileSort>("default");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const filteredFiles = FILE_SOURCES.filter((source) =>
    `${source.name} ${source.fileName} ${source.tableName}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const visibleFiles = [...filteredFiles].sort((left, right) => {
    if (sort === "updated") {
      return new Date(right.lastUpdated).getTime() - new Date(left.lastUpdated).getTime();
    }
    if (sort === "name-asc") return left.name.localeCompare(right.name);
    if (sort === "name-desc") return right.name.localeCompare(left.name);
    return 0;
  });
  const canSelectFile = FILE_SOURCES.some(
    (source) => source.id === selectedId && source.active,
  );

  return (
    <section className="ds-db-manager ds-file-manager">
      <header className="ds-db-manager__titlebar">
        <h2>Select File</h2>
        <button type="button" aria-label="Close" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="ds-db-manager__toolbar">
        <h3>Uploaded Files</h3>
        <div className="ds-db-manager__toolbar-actions">
          <label className="ds-db-manager__search">
            <MagnifyingGlass size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files..."
            />
          </label>
          <button
            type="button"
            className="ds-db-manager__new"
            onClick={onUploadNewFile}
          >
            <Plus size={17} aria-hidden="true" />
            Upload New File
          </button>
        </div>
      </div>

      <div className="ds-db-manager__filters">
        <div className="ds-db-manager__menu-wrap">
          <button
            type="button"
            className={sortMenuOpen ? "is-open" : ""}
            aria-expanded={sortMenuOpen}
            aria-haspopup="menu"
            onClick={() => setSortMenuOpen((open) => !open)}
          >
            <FunnelSimple size={15} aria-hidden="true" />
            {FILE_SORT_LABELS[sort]}
            <CaretDown size={15} aria-hidden="true" />
          </button>
          {sortMenuOpen && (
            <div className="ds-db-manager__menu ds-db-manager__sort-menu" role="menu">
              <div className="dropdown-menu__inner">
                {(Object.entries(FILE_SORT_LABELS) as [FileSort, string][]).map(
                  ([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={sort === value ? "is-selected" : ""}
                      role="menuitem"
                      onClick={() => {
                        setSort(value);
                        setSortMenuOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ds-db-manager__columns" aria-hidden="true">
        <span>Uploaded Files</span>
        <span>Last Tested</span>
      </div>

      <div className="ds-db-manager__list" role="listbox" aria-label="Uploaded files">
        {visibleFiles.map((source) => {
          const selected = source.active && selectedId === source.id;
  return (
            <div
              key={source.id}
              role="option"
              tabIndex={source.active ? 0 : -1}
              aria-selected={selected}
              aria-disabled={!source.active}
              className={
                "ds-db-manager-row ds-file-manager-row" +
                (selected ? " is-selected" : "") +
                (!source.active ? " is-disabled" : "")
              }
              onClick={() => {
                if (source.active) onChange(source.id);
              }}
              onKeyDown={(event) => {
                if (
                  source.active &&
                  event.currentTarget === event.target &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onChange(source.id);
                }
              }}
            >
              <div className="ds-file-manager-row__file ds-file-manager-row__file--without-icon">
                <div className="ds-db-manager-row__connection">
                  <strong>{source.name}</strong>
                  <div>
                    <span>{source.fileName}</span>
                    <span>
                      Uploaded File · {source.rows.toLocaleString()} rows · {source.tableName}
                    </span>
                  </div>
                </div>
              </div>
              <span className="ds-db-manager-row__actions">
                <time className="ds-db-manager-row__updated">{source.lastUpdated}</time>
                <button
                  type="button"
                  aria-label={`Information about ${source.name}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Info size={20} aria-hidden="true" />
          </button>
              </span>
            </div>
          );
        })}
        {visibleFiles.length === 0 && (
          <p className="ds-db-manager__empty">No uploaded files match your search.</p>
        )}
      </div>

      <footer className="ds-db-manager__footer">
        <button type="button" className="ds-db-manager__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="ds-db-manager__select"
          disabled={!canSelectFile}
          onClick={onSelect}
        >
          Select File
        </button>
      </footer>
    </section>
  );
}

function DataFlowPicker({
  selectedId,
  flowMode,
  onChange,
  onCancel,
  onSelect,
}: {
  selectedId: string | null;
  flowMode: "data-flow" | "etl-flow";
  onChange: (id: string) => void;
  onCancel: () => void;
  onSelect: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DataFlowSort>("default");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const isEtlFlow = flowMode === "etl-flow";
  const filteredFlows = DATA_FLOWS.filter((flow) =>
    `${flow.name} ${flow.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const visibleFlows = [...filteredFlows].sort((left, right) => {
    if (sort === "updated") {
      return new Date(right.lastUpdated).getTime() - new Date(left.lastUpdated).getTime();
    }
    if (sort === "name-asc") return left.name.localeCompare(right.name);
    if (sort === "name-desc") return right.name.localeCompare(left.name);
    return 0;
  });

  return (
    <section className="ds-db-manager ds-data-flow-manager">
      <header className="ds-db-manager__titlebar">
        <h2>{isEtlFlow ? "Select ETL Flow" : "Select Data Flow"}</h2>
        <button type="button" aria-label="Close" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="ds-db-manager__toolbar">
        <h3>{isEtlFlow ? "ETL Flows" : "Data Flows"}</h3>
        <div className="ds-db-manager__toolbar-actions">
          <label className="ds-db-manager__search">
            <MagnifyingGlass size={17} aria-hidden="true" />
        <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isEtlFlow ? "Search ETL flows..." : "Search data flows..."}
            />
          </label>
        </div>
      </div>

      <div className="ds-db-manager__filters">
        <div className="ds-db-manager__menu-wrap">
          <button
            type="button"
            className={sortMenuOpen ? "is-open" : ""}
            aria-expanded={sortMenuOpen}
            aria-haspopup="menu"
            onClick={() => setSortMenuOpen((open) => !open)}
          >
            <FunnelSimple size={15} aria-hidden="true" />
            {DATA_FLOW_SORT_LABELS[sort]}
            <CaretDown size={15} aria-hidden="true" />
        </button>
          {sortMenuOpen && (
            <div className="ds-db-manager__menu ds-db-manager__sort-menu" role="menu">
              <div className="dropdown-menu__inner">
                {(Object.entries(DATA_FLOW_SORT_LABELS) as [DataFlowSort, string][]).map(
                  ([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={sort === value ? "is-selected" : ""}
                      role="menuitem"
                      onClick={() => {
                        setSort(value);
                        setSortMenuOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ds-db-manager__columns" aria-hidden="true">
        <span>{isEtlFlow ? "ETL Flows" : "Data Flows"}</span>
        <span>Last Updated</span>
      </div>

      <div className="ds-db-manager__list" role="listbox" aria-label="Data flows">
        {visibleFlows.map((flow) => {
          const selected = selectedId === flow.id;
          return (
            <div
              key={flow.id}
              role="option"
              tabIndex={0}
              aria-selected={selected}
              className={
                "ds-db-manager-row ds-data-flow-manager-row" + (selected ? " is-selected" : "")
              }
              onClick={() => onChange(flow.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange(flow.id);
                }
              }}
            >
              <div className="ds-file-manager-row__file">
                <div className="ds-db-manager-row__connection">
                  <strong>{flow.name}</strong>
                  {flow.description.trim().toLowerCase() !== "no description" && (
                    <div>
                      <span>{flow.description}</span>
                    </div>
                  )}
                </div>
              </div>
              <span className="ds-db-manager-row__actions">
                <time className="ds-db-manager-row__updated">{flow.lastUpdated}</time>
                <button
                  type="button"
                  aria-label={`Information about ${flow.name}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Info size={20} aria-hidden="true" />
        </button>
              </span>
            </div>
          );
        })}
        {visibleFlows.length === 0 && (
          <p className="ds-db-manager__empty">
            No {isEtlFlow ? "ETL flows" : "data flows"} match your search.
          </p>
        )}
      </div>

      <footer className="ds-db-manager__footer">
        <button type="button" className="ds-db-manager__cancel" onClick={onCancel}>
          Cancel
            </button>
        <button
          type="button"
          className="ds-db-manager__select"
          disabled={!selectedId}
          onClick={onSelect}
        >
          {isEtlFlow ? "Select ETL Flow" : "Select Data Flow"}
        </button>
      </footer>
    </section>
  );
}

function ApiRequestPanel({
  request,
  requests,
}: {
  request: string;
  requests: ApiRequest[];
}) {
  const [activeTab, setActiveTab] = useState<"parameters" | "headers" | "body">("parameters");
  const [bodyType, setBodyType] = useState<"none" | "raw" | "form-data">("raw");
  const [bodyValue, setBodyValue] = useState("");
  const selectedRequest = requests.find((option) => option.id === request) ?? null;

  useEffect(() => {
    setActiveTab("parameters");
  }, [request]);

  return (
    <section className="ds-api-request">
      <header className="ds-api-request__header">
        <h3>API Request</h3>
        <button type="button" className="ds-api-request__send" disabled={!selectedRequest}>
          <Play size={14} weight="fill" aria-hidden="true" />
          Send
        </button>
      </header>
      <div className="ds-api-request__body">
        {selectedRequest && (
          <>
            <div className="ds-api-request__endpoint">
              <span className={`is-${selectedRequest.method.toLowerCase()}`}>
                {selectedRequest.method}
              </span>
              <code>{selectedRequest.endpoint}</code>
      </div>

            <div className="ds-api-request__tabs" role="tablist" aria-label="Request configuration">
              {(["parameters", "headers", "body"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
                  aria-selected={activeTab === tab}
                  className={activeTab === tab ? "is-active" : ""}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

            {activeTab === "parameters" ? (
              <div className="ds-api-request__parameters">
                <ApiParameterSection title="Query Parameters" />
                <ApiParameterSection title="Path Parameters" />
                </div>
            ) : activeTab === "headers" ? (
              <div className="ds-api-request__headers">
                <ApiParameterSection />
              </div>
            ) : (
              <div className="ds-api-request__body-config">
                <label>Body Type</label>
                <Dropdown
                  value={bodyType}
                  onChange={(value) =>
                    setBodyType(value as "none" | "raw" | "form-data")
                  }
                  options={[
                    { value: "none", label: "None" },
                    { value: "raw", label: "Raw (JSON)" },
                    { value: "form-data", label: "Form Data" },
                  ]}
                  ariaLabel="API request body type"
                  className="ds-api-request__body-dropdown"
                  compact
                />
                {bodyType === "raw" && (
                  <JsonBodyEditor value={bodyValue} onChange={setBodyValue} />
                )}
                {bodyType === "form-data" && (
                  <ApiParameterSection />
                )}
                {bodyType === "none" && (
                  <div className="ds-api-request__tab-empty">No request body.</div>
                )}
              </div>
            )}
          </>
        )}
              </div>
            </section>
  );
}

const JSON_EDITOR_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;

function HighlightedJson({ value }: { value: string }) {
  return (
    <pre className="ds-query__highlight ds-api-json-editor__highlight" aria-hidden="true">
      <code>
        {(value || " ").split(JSON_EDITOR_TOKEN_PATTERN).map((token, index) => {
          const className = token.startsWith('"')
            ? "is-string"
            : /^(?:true|false|null)$/.test(token)
              ? "is-keyword"
              : /^-?\d/.test(token)
                ? "is-number"
                : undefined;
          return (
            <span className={className} key={`${index}-${token}`}>
              {token}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function EditorLineNumbers({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const lineCount = Math.max(1, value.split("\n").length);

  return (
    <pre
      className={`ds-query__line-numbers ${className}`.trim()}
      aria-hidden="true"
      onWheel={(event) => {
        const textarea = event.currentTarget.parentElement?.querySelector("textarea");
        if (!textarea) return;
        event.preventDefault();
        textarea.scrollBy({ top: event.deltaY, left: event.deltaX });
      }}
    >
      {Array.from({ length: lineCount }, (_, index) => index + 1).join("\n")}
    </pre>
  );
}

function JsonBodyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ds-query__editor ds-api-json-editor">
      <EditorLineNumbers value={value} className="ds-api-json-editor__line-numbers" />
      <div className="ds-query__code-layer">
        <HighlightedJson value={value} />
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            const highlight = event.currentTarget.previousElementSibling as HTMLElement | null;
            const lineNumbers = event.currentTarget
              .closest(".ds-api-json-editor")
              ?.querySelector<HTMLElement>(".ds-api-json-editor__line-numbers");
            if (highlight) {
              highlight.scrollTop = event.currentTarget.scrollTop;
              highlight.scrollLeft = event.currentTarget.scrollLeft;
            }
            if (lineNumbers) lineNumbers.scrollTop = event.currentTarget.scrollTop;
          }}
          aria-label="JSON request body"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

type ApiParameterRow = { id: number; key: string; value: string };

function ApiParameterSection({ title }: { title?: string }) {
  const [rows, setRows] = useState<ApiParameterRow[]>([{ id: 1, key: "", value: "" }]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const rowLabel = title ?? "Header";
  const canManageRows = rows.length > 1;

  const withTrailingEmptyRow = (nextRows: ApiParameterRow[]) => {
    const next = nextRows.length ? [...nextRows] : [{ id: 1, key: "", value: "" }];
    const isEmpty = (row: ApiParameterRow) => !row.key.trim() && !row.value.trim();
    while (
      next.length > 1 &&
      isEmpty(next[next.length - 1]) &&
      isEmpty(next[next.length - 2])
    ) {
      next.pop();
    }
    const last = next[next.length - 1];
    if (!isEmpty(last)) {
      next.push({
        id: next.reduce((highest, row) => Math.max(highest, row.id), 0) + 1,
        key: "",
        value: "",
      });
    }
    return next;
  };

  const updateRow = (id: number, field: "key" | "value", value: string) => {
    setRows((current) =>
      withTrailingEmptyRow(
        current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
      ),
    );
  };

  const removeRow = (id: number) => {
    if (!canManageRows) return;
    setRows((current) => withTrailingEmptyRow(current.filter((row) => row.id !== id)));
  };

  const moveRow = (targetId: number) => {
    if (!canManageRows || draggingId === null || draggingId === targetId) return;
    setRows((current) => {
      const fromIndex = current.findIndex((row) => row.id === draggingId);
      const targetIndex = current.findIndex((row) => row.id === targetId);
      if (fromIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [dragged] = next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, dragged);
      return withTrailingEmptyRow(next);
    });
    setDraggingId(null);
  };

  return (
    <section className="ds-api-parameter-section">
      {title && <h4>{title}</h4>}
      <div
        className={
          "ds-api-parameter-table" + (!canManageRows ? " is-single-row" : "")
        }
      >
        <header>
          {canManageRows && <span aria-hidden="true" />}
          <span className="ds-api-parameter-table__heading">Key</span>
          <span className="ds-api-parameter-table__heading">Value</span>
          {canManageRows && <span aria-hidden="true" />}
        </header>
        <div className="ds-api-parameter-table__rows">
          {rows.map((row) => (
            <div
              className={
                "ds-api-parameter-row" + (draggingId === row.id ? " is-dragging" : "")
              }
              key={row.id}
              onDragOver={(event) => {
                if (canManageRows) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveRow(row.id);
              }}
            >
              {canManageRows ? (
                <button
                  type="button"
                  className="ds-api-parameter-row__drag"
                  draggable
                  aria-label={`Reorder ${rowLabel} row`}
                  onDragStart={(event) => {
                    setDraggingId(row.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(row.id));
                  }}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <DotsSixVertical size={18} weight="bold" aria-hidden="true" />
                </button>
              ) : null}
                  <input
                  className="ds-api-parameter-row__key"
                  value={row.key}
                  onChange={(event) => updateRow(row.id, "key", event.target.value)}
                    placeholder="Key"
                  aria-label={`${rowLabel} key`}
                  />
                  <input
                  className="ds-api-parameter-row__value"
                  value={row.value}
                  onChange={(event) => updateRow(row.id, "value", event.target.value)}
                    placeholder="Value"
                  aria-label={`${rowLabel} value`}
              />
              {canManageRows && (
                <button
                  type="button"
                  className="ds-api-parameter-row__delete"
                  aria-label={`Remove ${rowLabel} row`}
                  onClick={() => removeRow(row.id)}
                >
                  <Trash size={17} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
                </div>
              </div>
            </section>
  );
}

const SQL_EDITOR_TOKEN_PATTERN =
  /(\$[A-Za-z_][A-Za-z0-9_]*|'(?:''|[^'])*'|\b(?:SELECT|FROM|JOIN|ON|WHERE|AND|OR|BETWEEN|ORDER|BY|AS|LIMIT|GROUP|HAVING|DESC|ASC)\b|\b\d+(?:\.\d+)?\b)/gi;

const SQL_EDITOR_KEYWORD_PATTERN =
  /^(?:SELECT|FROM|JOIN|ON|WHERE|AND|OR|BETWEEN|ORDER|BY|AS|LIMIT|GROUP|HAVING|DESC|ASC)$/i;

const QUERY_FILTER_OPTIONS = [
  "Airports",
  "AQI Timeseries",
  "CalendarTimeSeries",
  "Delay Severity",
  "Dubai Top Transit Destination Station",
  "Forecast Date & Time",
  "FusionWhereboutCatFilter",
  "Fusion Timeseries",
  "gender",
  "Incident Type",
  "Junction Locations",
  "Location",
  "Location Filter",
  "Riyadh Air Quality Index Timeseries",
  "Riyadh Traffic — Hourly Timeline",
  "Riyadh Traffic",
  "Riyadh Traffic Timeseries",
  "Sample Date",
  "Test-TimeSeries-2",
  "TestCallIcon",
  "TestCAtIcon",
  "TestLocation",
  "Time Horizon",
  "Time Period",
  "Time Range",
  "Violation Type",
];

function HighlightedSql({
  value,
  filterBindings,
  onVariableClick,
}: {
  value: string;
  filterBindings: Record<string, string>;
  onVariableClick: (variable: string, rect: DOMRect) => void;
}) {
  return (
    <pre className="ds-query__highlight" aria-hidden="true">
      <code>
        {(value || " ").split(SQL_EDITOR_TOKEN_PATTERN).map((token, index) => {
          const className = token.startsWith("$")
            ? "is-variable"
            : token.startsWith("'")
            ? "is-string"
            : SQL_EDITOR_KEYWORD_PATTERN.test(token)
              ? "is-keyword"
              : /^\d/.test(token)
                ? "is-number"
                : undefined;
          return (
            <span
              className={className}
              key={`${index}-${token}`}
              {...(token.startsWith("$")
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: (event: ReactMouseEvent<HTMLSpanElement>) => {
                      event.stopPropagation();
                      onVariableClick(token, event.currentTarget.getBoundingClientRect());
                    },
                    onKeyDown: (event: ReactKeyboardEvent<HTMLSpanElement>) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onVariableClick(token, event.currentTarget.getBoundingClientRect());
                    },
                  }
                : {})}
            >
              {token}
              {token.startsWith("$") && filterBindings[token] && (
                <span className="is-variable__binding">: {filterBindings[token]}</span>
              )}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function DatabaseSchemaBrowser({
  database,
  onClose,
}: {
  database: DatabaseConnection;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<SchemaTable | null>(null);
  const [activeSchemaTab, setActiveSchemaTab] = useState<
    "structure" | "relationships" | "samples" | "technical"
  >("structure");
  const [payloadExpanded, setPayloadExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const meta = DATABASE_CONNECTION_META[database.id] ?? {
    type: "PostgreSQL" as DatabaseType,
    lastUpdated: "Just now",
    updatedMinutes: 0,
  };
  const namespace =
    database.schema && database.schema !== "Database"
      ? database.schema
      : `${database.name.toLowerCase().replace(/\s+/g, "_")}_dm`;
  const visibleTables = SCHEMA_TABLES.filter((table) =>
    table.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalRows = SCHEMA_TABLES.reduce((total, table) => total + table.rows, 0);
  const rawSchemaPayload = JSON.stringify(
    {
      source: {
        id: database.id,
        name: database.name,
        type: "database",
        database_type: meta.type.toLowerCase(),
        metadata: {
          active: database.active,
          namespace,
        },
      },
      normalized: {
        engine: meta.type.toLowerCase(),
        sourceFamily: "database",
        sourceType: meta.type.toLowerCase(),
        entityCount: SCHEMA_TABLES.length,
        relationshipCount: 21,
        namespaces: [namespace],
        capabilities: {
          queryable: true,
          previewable: true,
          supportsFilters: true,
        },
      },
      selectedEntity: selectedTable
        ? {
            name: selectedTable.name,
            columns: selectedTable.columns,
            rows: selectedTable.rows,
          }
        : null,
    },
    null,
    2,
  );
  const selectTable = (table: SchemaTable) => {
    setSelectedTable(table);
    setActiveSchemaTab("structure");
  };

  useEffect(() => {
    if (!refreshing) return;
    const timer = window.setTimeout(() => setRefreshing(false), 900);
    return () => window.clearTimeout(timer);
  }, [refreshing]);

  return (
    <section className="ds-schema-browser">
      <header className="ds-schema-browser__titlebar">
        <h2>Schema Browser</h2>
        <button type="button" aria-label="Close schema browser" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="ds-schema-browser__source">
        <div>
          <div className="ds-schema-browser__source-title">
            <strong>{database.name}</strong>
            <div className="ds-schema-browser__badges">
              <span>{meta.type}</span>
              <span className={database.active ? "is-active" : ""}>
                {database.active ? "Active" : "Inactive"}
              </span>
          </div>
          </div>
          <small>Read-only schema visibility for this database connection.</small>
        </div>
      </div>

      <div className="ds-schema-browser__body">
        <aside className="ds-schema-browser__sidebar">
          <button
            type="button"
            className={!selectedTable ? "is-selected" : ""}
            onClick={() => setSelectedTable(null)}
          >
            Overview
          </button>
          <div className="ds-schema-browser__objects-heading">
            <strong>Objects</strong>
            <span>{SCHEMA_TABLES.length} total</span>
          </div>
          <label className="ds-schema-browser__search settings__search">
            <MagnifyingGlass
              className="settings__search-ico"
              size={20}
              aria-hidden="true"
            />
            <input
              className="settings__search-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search objects..."
            />
            {search && (
              <button
                type="button"
                className="settings__search-clear"
                aria-label="Clear object search"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSearch("")}
              >
                <X size={14} weight="regular" aria-hidden="true" />
              </button>
            )}
          </label>
          <div className="ds-schema-browser__table-list">
            {visibleTables.map((table) => (
              <button
                type="button"
                key={table.name}
                className={selectedTable?.name === table.name ? "is-selected" : ""}
                onClick={() => selectTable(table)}
              >
                <strong>{table.name}</strong>
                <span>
                  {table.columns} columns · {table.rows.toLocaleString()}
                </span>
              </button>
            ))}
            {visibleTables.length === 0 && <p>No tables match your search.</p>}
          </div>
        </aside>

        <main className="ds-schema-browser__content">
          {refreshing ? (
            <div className="ds-schema-browser__loading" role="status">
              <i aria-hidden="true" />
              Refreshing schema…
          </div>
          ) : selectedTable ? (
            <>
              <div className="ds-schema-browser__object-header">
                <div>
                  <span>{namespace}</span>
                  <h3>
                    {namespace}.{selectedTable.name}
                  </h3>
                  <p>
                    {selectedTable.rows.toLocaleString()} rows, {selectedTable.columns} columns
                  </p>
                </div>
                <div className="ds-schema-browser__object-badges">
                  <span>Table</span>
                  <span>
                    PK:{" "}
                    {selectedTable.name === "dim_emirate"
                      ? "emirate_id"
                      : selectedTable.name.replace(/^(?:dim|fact)_/, "") + "_id"}
                  </span>
                </div>
              </div>
              <nav className="ds-schema-browser__tabs" aria-label="Object details">
                {(
                  [
                    ["structure", "Structure"],
                    ["relationships", "Relationships"],
                    ["samples", "Sample Rows"],
                    ["technical", "Technical"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={activeSchemaTab === id ? "is-selected" : ""}
                    onClick={() => setActiveSchemaTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {activeSchemaTab === "structure" ? (
                <>
                  <section className="ds-schema-browser__columns-table">
                    <header>
                      <span>Column</span>
                      <span>Type</span>
                      <span>Nullable</span>
                      <span>Default</span>
                      <span>Primary Key</span>
                    </header>
                    {SCHEMA_COLUMNS.slice(
                      0,
                      Math.min(selectedTable.columns, SCHEMA_COLUMNS.length),
                    ).map(([name, type, nullable, defaultValue, primaryKey]) => (
                      <div key={name}>
                        <strong>{name}</strong>
                        <code>{type}</code>
                        <span>{nullable}</span>
                        <span>{defaultValue}</span>
                        <span>{primaryKey}</span>
                      </div>
                    ))}
                  </section>
                  <section className="ds-schema-browser__indexes">
                    <h3>Indexes</h3>
                    <div>
                      {[
                        [`${selectedTable.name}_name_key`, "name", "Unique"],
                        [
                          `${selectedTable.name}_pkey`,
                          selectedTable.name === "dim_emirate"
                            ? "emirate_id"
                            : selectedTable.name.replace(/^(?:dim|fact)_/, "") + "_id",
                          "Unique",
                        ],
                        [`idx_${selectedTable.name}_geometry`, "geometry", ""],
                      ].map(([name, column, badge]) => (
                        <article key={name}>
                          <header>
                            <strong>{name}</strong>
                            {badge && <span>{badge}</span>}
                          </header>
                          <p>{column}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : activeSchemaTab === "relationships" ? (
                <section className="ds-schema-browser__relationships">
                  <p>
                    Showing relationships involving{" "}
                    <code>
                      {namespace}.{selectedTable.name}
                    </code>
                    .
                  </p>
                  <div className="ds-schema-browser__relationships-table">
                    <header>
                      <span>From</span>
                      <span>From Fields</span>
                      <span>To</span>
                      <span>To Fields</span>
                      <span>Type</span>
                    </header>
                    {[
                      "dim_facility",
                      "dim_zone",
                      "fact_consumption",
                      "fact_emission",
                      "fact_grid_event",
                      "fact_inspection",
                      "fact_violation",
                      "fact_zone_load",
                    ].map((name) => (
                      <div key={name}>
                        <span>
                          {namespace}.{name}
                        </span>
                        <span>emirate_id</span>
                        <span>
                          {namespace}.{selectedTable.name}
                        </span>
                        <span>emirate_id</span>
                        <span>Foreign Key</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : activeSchemaTab === "samples" ? (
                <section className="ds-schema-browser__samples">
                  <p>
                    Showing only the sample data returned by the runner. No paging or ad-hoc querying
                    is included in v1.
                  </p>
                  <div className="ds-schema-browser__sample-table">
                    <header>
                      {["Area_km2", "Centroid", "Emirate_id", "Geometry", "Name", "Population"].map(
                        (column) => <span key={column}>{column}</span>,
                      )}
                    </header>
                    {[
                      ["{5873856 -2 false finite…", "0101000020E610…", "1", "0106000020E610…", "Abu Dhabi Emirate", "3800000"],
                      ["{26234 -2 false finite…", "0101000020E610…", "2", "0106000020E610…", "Ajman", "550000"],
                      ["{377314 -2 false finite…", "0101000020E610…", "3", "0106000020E610…", "Dubai", "3600000"],
                    ].map((row) => (
                      <div key={row[2]}>
                        {row.map((value, index) => (
                          <span key={`${index}-${value}`}>{value}</span>
                        ))}
                      </div>
                    ))}
                  </div>
      </section>
              ) : (
                <section className="ds-schema-browser__technical">
                  <div className="ds-schema-browser__technical-grid">
                    <section>
                      <h3>Capabilities</h3>
                      <dl>
                        {[
                          ["Source type", meta.type.toLowerCase()],
                          ["Source family", "database"],
                          ["Schema version", "v1"],
                          ["Runner engine", meta.type.toLowerCase()],
                          ["Generated", "Aug 25, 2026, 10:11 AM"],
                          ["Queryable", "Yes"],
                          ["Previewable", "Yes"],
                          ["Supports filters", "Yes"],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
    </div>
                        ))}
                      </dl>
                    </section>
                    <section>
                      <h3>Physical Objects</h3>
                      <p>Nothing to show.</p>
                    </section>
                  </div>
                  <section className="ds-schema-browser__payload">
                    <h3>Raw Schema Payload</h3>
                    <div className="ds-schema-browser__payload-actions">
                      <button type="button" onClick={() => setPayloadExpanded(true)}>
                        Expand All
                      </button>
                      <button type="button" onClick={() => setPayloadExpanded(false)}>
                        Collapse All
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(rawSchemaPayload)}
                      >
                        Copy All
                      </button>
                    </div>
                    <pre>
                      <code>
                        {payloadExpanded
                          ? rawSchemaPayload
                          : `${rawSchemaPayload.split("\n").slice(0, 12).join("\n")}\n  …\n}`}
                      </code>
                    </pre>
                  </section>
                </section>
              )}
            </>
          ) : (
            <>
              <p className="ds-schema-browser__summary">
                Summary for this source. Select a table in the list to inspect its structure and
                sample metadata.
              </p>
              <div className="ds-schema-browser__metrics">
                {[
                  ["Engine", meta.type],
                  ["Tables", String(SCHEMA_TABLES.length)],
                  ["Relationships", "21"],
                  ["Namespaces", "1"],
                  ["Rows", totalRows.toLocaleString()],
                  ["Generated", "Aug 25, 2026 · 10:11 AM"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="ds-schema-browser__overview-grid">
                <section>
                  <h3>Top tables</h3>
                  {SCHEMA_TABLES.slice(6, 11).map((table) => (
                    <button type="button" key={table.name} onClick={() => selectTable(table)}>
                      <span>
                        {namespace}.{table.name}
                      </span>
                      <strong>{table.rows.toLocaleString()}</strong>
                    </button>
                  ))}
                </section>
                <section>
                  <h3>Namespaces</h3>
                  <span>{namespace}</span>
                </section>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="ds-schema-browser__footer">
        <button type="button" onClick={() => setRefreshing(true)} disabled={refreshing}>
          <ArrowClockwise size={16} aria-hidden="true" />
          Refresh
        </button>
      </footer>
    </section>
  );
}

function SourcePickerModal({
  children,
  onClose,
  variant = "default",
}: {
  children: ReactNode;
  onClose: () => void;
  variant?:
    | "default"
    | "database"
    | "create-database"
    | "create-api"
    | "api"
    | "marketplace"
    | "file"
    | "data-flow"
    | "query-assistant"
    | "schema-browser"
    | "upload-file";
}) {
  useEffect(() => {
    if (variant === "query-assistant") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, variant]);

  return createPortal(
    <div
      className="ds-source-picker-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={
          "ds-source-picker-modal" +
          (variant === "database"
            ? " ds-source-picker-modal--database"
            : variant === "create-database"
              ? " ds-source-picker-modal--create-database"
              : variant === "create-api"
                ? " ds-source-picker-modal--create-api"
              : variant === "api"
                ? " ds-source-picker-modal--api"
                : variant === "marketplace"
                  ? " ds-source-picker-modal--marketplace"
                  : variant === "file"
                    ? " ds-source-picker-modal--file"
                    : variant === "data-flow"
                      ? " ds-source-picker-modal--data-flow"
                      : variant === "query-assistant"
                        ? " ds-source-picker-modal--query-assistant"
                      : variant === "schema-browser"
                        ? " ds-source-picker-modal--schema-browser"
                        : variant === "upload-file"
                          ? " ds-source-picker-modal--upload-file"
                    : "")
        }
        role="dialog"
        aria-modal="true"
      >
        {children}
          </div>
    </div>,
    portalRoot(),
  );
}

function QueryAssistantModal({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (prompt: string) => string;
}) {
  return (
    <SourcePickerModal variant="query-assistant" onClose={onClose}>
      <QueryAssistantChat onClose={onClose} onGenerate={onGenerate} />
    </SourcePickerModal>
  );
}

function QueryEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [filterBindings, setFilterBindings] = useState<Record<string, string>>({});
  const [filterPopover, setFilterPopover] = useState<{
    variable: string;
    top: number;
    left: number;
  } | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterPopover) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (filterPopoverRef.current?.contains(target)) return;
      if (target.closest(".cp-picker-menu")) return;
      setFilterPopover(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterPopover(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filterPopover]);

  return (
    <>
      <section className="ds-query">
        <header className="ds-query__header">
          <h3>Query</h3>
          <div className="ds-query__actions">
            <button
              type="button"
              className="ds-query__generate"
              onClick={() => setAssistantOpen(true)}
            >
              <Sparkle size={14} weight="fill" aria-hidden="true" />
              {hasGenerated ? "Regenerate" : "Generate"}
            </button>
            <button type="button" className="ds-query__execute">
              <Play size={14} weight="fill" aria-hidden="true" />
              Execute
            </button>
          </div>
        </header>
        <div className="ds-query__editor">
          <EditorLineNumbers value={value} />
          <div className="ds-query__code-layer">
            <HighlightedSql
              value={value}
              filterBindings={filterBindings}
              onVariableClick={(variable, rect) => {
                const width = 280;
                const height = 320;
                setFilterSearch("");
                setFilterPopover({
                  variable,
                  left: Math.max(
                    12,
                    Math.min(rect.left, window.innerWidth - width - 12),
                  ),
                  top: Math.max(
                    12,
                    Math.min(rect.bottom + 8, window.innerHeight - height - 12),
                  ),
                });
              }}
            />
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onScroll={(event) => {
                setFilterPopover(null);
                const highlight = event.currentTarget.previousElementSibling;
                if (highlight instanceof HTMLElement) {
                  highlight.scrollTop = event.currentTarget.scrollTop;
                  highlight.scrollLeft = event.currentTarget.scrollLeft;
                }
                const lineNumbers = event.currentTarget
                  .closest(".ds-query__editor")
                  ?.querySelector<HTMLElement>(".ds-query__line-numbers");
                if (lineNumbers) lineNumbers.scrollTop = event.currentTarget.scrollTop;
              }}
              aria-label="SQL query"
              spellCheck={false}
            />
          </div>
        </div>
        <footer className="ds-query__footer">
          <span>Dialect: SQL (Standard SQL)</span>
        </footer>
      </section>

      {assistantOpen && (
        <QueryAssistantModal
          onClose={() => setAssistantOpen(false)}
          onGenerate={(prompt) => {
            const currentQuery =
              value.trim() || "SELECT *\nFROM source_data\nLIMIT 100;";
            const generatedQuery = `-- Generated from: ${prompt}\n${currentQuery}`;
            onChange(generatedQuery);
            setHasGenerated(true);
            return generatedQuery;
          }}
        />
      )}

      {filterPopover &&
        createPortal(
          <div
            ref={filterPopoverRef}
            className="cp-picker-menu cp-picker-menu--flyout ds-query-filter-menu"
            role="listbox"
            aria-label={`Bind ${filterPopover.variable} to a filter`}
            style={{ top: filterPopover.top, left: filterPopover.left }}
          >
            <div className="dropdown-menu__inner">
              <div className="cp-picker-search">
                <input
                  autoFocus
                  type="search"
                  value={filterSearch}
                  placeholder="Search filters"
                  aria-label="Search filters"
                  onChange={(event) => setFilterSearch(event.target.value)}
                />
                {filterSearch && (
                  <button
                    type="button"
                    className="cp-picker-search-clear"
                    aria-label="Clear filter search"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setFilterSearch("")}
                  >
                    <X size={14} weight="regular" aria-hidden="true" />
                  </button>
                )}
                <MagnifyingGlass
                  className="cp-picker-search-ico"
                  size={16}
                  aria-hidden="true"
                />
              </div>
              <div className="cp-picker-list">
                {[
                  { value: "", label: "— unbound —" },
                  ...QUERY_FILTER_OPTIONS.map((filter) => ({
                    value: filter,
                    label: filter,
                  })),
                ]
                  .filter((filter) =>
                    filter.label.toLowerCase().includes(filterSearch.trim().toLowerCase()),
                  )
                  .map((filter) => {
                    const selected =
                      (filterBindings[filterPopover.variable] ?? "") === filter.value;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={"cp-picker-row" + (selected ? " is-selected" : "")}
                        key={filter.value || "unbound"}
                        onClick={() => {
                          setFilterBindings((current) => {
                            if (!filter.value) {
                              const next = { ...current };
                              delete next[filterPopover.variable];
                              return next;
                            }
                            return {
                              ...current,
                              [filterPopover.variable]: filter.value,
                            };
                          });
                          setFilterPopover(null);
                        }}
                      >
                        <span className="cp-picker-row-name">{filter.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>,
          portalRoot(),
        )}
    </>
  );
}

function SourceConfiguration({
  sourceType,
  mlInputSource,
  onMlInputSourceChange,
  selectedDatabase,
  isDatabaseConnecting,
  onOpenDatabasePicker,
  onOpenDatabaseSchemaBrowser,
  selectedApi,
  onOpenApiPicker,
  selectedRequest,
  selectedFile,
  onOpenFilePicker,
  onOpenFileSchemaBrowser,
  fileQuery,
  onFileQueryChange,
  mlSelectedDatabase,
  isMlDatabaseConnecting,
  onOpenMlDatabasePicker,
  onOpenMlDatabaseSchemaBrowser,
  mlDatabaseQuery,
  onMlDatabaseQueryChange,
  mlSelectedApi,
  onOpenMlApiPicker,
  mlSelectedRequest,
  mlSelectedFile,
  onOpenMlFilePicker,
  mlFileQuery,
  onMlFileQueryChange,
  selectedDataFlow,
  onOpenDataFlowPicker,
  outputProjection,
  onOutputProjectionChange,
  selectedMarketplaceProvider,
  onOpenMarketplacePicker,
  query,
  onQueryChange,
}: {
  sourceType: SourceType;
  mlInputSource: MlInputSource | null;
  onMlInputSourceChange: (source: MlInputSource | null) => void;
  selectedDatabase: DatabaseConnection | null;
  isDatabaseConnecting: boolean;
  onOpenDatabasePicker: () => void;
  onOpenDatabaseSchemaBrowser: () => void;
  selectedApi: ApiSource | null;
  onOpenApiPicker: () => void;
  selectedRequest: string;
  selectedFile: FileSource | null;
  onOpenFilePicker: () => void;
  onOpenFileSchemaBrowser: () => void;
  fileQuery: string;
  onFileQueryChange: (query: string) => void;
  mlSelectedDatabase: DatabaseConnection | null;
  isMlDatabaseConnecting: boolean;
  onOpenMlDatabasePicker: () => void;
  onOpenMlDatabaseSchemaBrowser: () => void;
  mlDatabaseQuery: string;
  onMlDatabaseQueryChange: (query: string) => void;
  mlSelectedApi: ApiSource | null;
  onOpenMlApiPicker: () => void;
  mlSelectedRequest: string;
  mlSelectedFile: FileSource | null;
  onOpenMlFilePicker: () => void;
  mlFileQuery: string;
  onMlFileQueryChange: (query: string) => void;
  selectedDataFlow: DataFlow | null;
  onOpenDataFlowPicker: () => void;
  outputProjection: string;
  onOutputProjectionChange: (query: string) => void;
  selectedMarketplaceProvider: MarketplaceProvider | null;
  onOpenMarketplacePicker: () => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const selectedApiRequest =
    selectedApi?.requests.find((request) => request.id === selectedRequest) ?? null;
  const mlSelectedApiRequest =
    mlSelectedApi?.requests.find((request) => request.id === mlSelectedRequest) ?? null;

  if (sourceType === "database") {
    return (
      <div className="ds-config-stack">
        <section className="ds-config">
          <FieldHeader title="Database Connection" />
          {selectedDatabase ? (
            <div className="ds-db-selected">
              <SourceTypeIcon name="database" size={20} />
              <span className="ds-db-selected__content ds-db-selected__content--database">
                <strong>{selectedDatabase.name}</strong>
              </span>
              <span className="ds-db-selected__actions">
                {!isDatabaseConnecting && (
                  <span className="ds-db-selected__success" role="status">
                    <CheckCircle size={16} weight="bold" aria-hidden="true" />
                    Connection established
                  </span>
                )}
                {isDatabaseConnecting ? (
                  <span className="ds-db-selected__loading" role="status">
                    <i aria-hidden="true" />
                    Connecting...
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ds-db-selected__schema-browser"
                    onClick={onOpenDatabaseSchemaBrowser}
                  >
                    Schema
                  </button>
                )}
                <button
                  type="button"
                  className="ds-db-selected__change"
                  onClick={onOpenDatabasePicker}
                >
                  Change
                </button>
              </span>
            </div>
          ) : (
            <SourceActionField
              label="Select Database Connection"
              icon={<SourceTypeIcon name="database" size={20} />}
              onClick={onOpenDatabasePicker}
            />
        )}
      </section>
        {selectedDatabase && !isDatabaseConnecting && (
          <QueryEditor value={query} onChange={onQueryChange} />
        )}
    </div>
    );
  }

  if (sourceType === "api") {
    return (
      <div className="ds-config-stack">
        <section className="ds-config">
          <FieldHeader title="API Request" />
          {selectedApi && selectedApiRequest ? (
            <div className="ds-db-selected ds-db-selected--no-trailing">
              <SourceTypeIcon name="api-request" size={20} />
              <span className="ds-db-selected__content">
                <strong>{selectedApiRequest.name}</strong>
                <small>Collection: {selectedApi.name}</small>
              </span>
              <button type="button" className="ds-db-selected__change" onClick={onOpenApiPicker}>
                Change
              </button>
            </div>
          ) : (
            <SourceActionField
              label="Select API Request"
              icon={<SourceTypeIcon name="api-request" size={20} />}
              onClick={onOpenApiPicker}
            />
          )}
        </section>
        {selectedApi && (
          <ApiRequestPanel
            request={selectedRequest}
            requests={selectedApi.requests}
          />
        )}
      </div>
    );
  }

  if (sourceType === "file-upload") {
    return (
      <>
        <div className="ds-config-stack">
          {selectedFile && (
            <section className="ds-config">
              <FieldHeader title="Apply ML Prediction (Optional)" required={false} />
              <div className="ds-config__notice" role="note">
                Enhance your data with machine learning predictions by selecting a model below.
                <br />
                No ML models available. Configure models in Platform Settings.
              </div>
            </section>
          )}
          <section className="ds-config">
            <FieldHeader title="Select File" required={false} />
            {selectedFile ? (
              <div className="ds-db-selected ds-db-selected--no-trailing">
                <SourceTypeIcon name="file" size={20} />
                <span className="ds-db-selected__content">
                  <strong>{selectedFile.name}</strong>
                  <small>
                    {selectedFile.fileName} · {selectedFile.rows.toLocaleString()} rows
                  </small>
                </span>
                <span className="ds-db-selected__actions">
                  <button
                    type="button"
                    className="ds-db-selected__schema-browser"
                    onClick={onOpenFileSchemaBrowser}
                  >
                    Schema
                  </button>
                  <button
                    type="button"
                    className="ds-db-selected__change"
                    onClick={onOpenFilePicker}
                  >
                    Change
                  </button>
                </span>
              </div>
            ) : (
              <SourceActionField
                label="Select File"
                icon={<SourceTypeIcon name="file" size={20} />}
                onClick={onOpenFilePicker}
              />
            )}
            <p className="ds-config__helper">
              Uploaded files are stored as source-backed tables. Select an existing file or upload a
              new one.
            </p>
          </section>
          {selectedFile && <QueryEditor value={fileQuery} onChange={onFileQueryChange} />}
        </div>
      </>
    );
  }

  if (sourceType === "ai-model") {
    return (
      <section className="ds-config">
        <FieldHeader title="AI Model Configuration" required={false} />
        <div className="ds-config__notice" role="note">
          AI Models are for conversational AI and language processing tasks. Configure your AI model
          settings in Platform Settings → AI Models.
        </div>
      </section>
    );
  }

  if (sourceType === "ml-model") {
    return (
      <div className="ds-config-stack">
        <section className="ds-config">
          <FieldHeader title="Select ML Model" />
          <p className="ds-config__empty">
            No ML models available. Please create an ML model first in Platform Settings.
          </p>
        </section>

        <section className="ds-config ds-config--separated">
          <FieldHeader title="Input Data For Predictions" />
          {mlInputSource ? (
            <button type="button" className="ds-ml-change-input" onClick={() => onMlInputSourceChange(null)}>
              <ArrowLeft size={14} aria-hidden="true" />
              Change input type
            </button>
          ) : (
            <>
              <div className="ds-ml-input-grid">
                {ML_INPUT_SOURCES.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className={
                      "ds-ml-input-card" +
                      (source.id === "file-source" ? " ds-ml-input-card--full" : "")
                    }
                    aria-pressed={false}
                    onClick={() => onMlInputSourceChange(source.id)}
                  >
                    <span className="ds-ml-input-card__icon">{source.icon}</span>
                    <strong>{source.title}</strong>
                    <span>{source.description}</span>
            </button>
                ))}
              </div>
            </>
          )}
        </section>

        {mlInputSource === "database" && (
          <>
            <section className="ds-config">
              <FieldHeader title="Database Connection" />
              {mlSelectedDatabase ? (
                <div className="ds-db-selected">
                  <SourceTypeIcon name="database" size={20} />
                  <span className="ds-db-selected__content ds-db-selected__content--database">
                    <strong>{mlSelectedDatabase.name}</strong>
                  </span>
                  <span className="ds-db-selected__actions">
                    {!isMlDatabaseConnecting && (
                      <span className="ds-db-selected__success" role="status">
                        <CheckCircle size={16} weight="bold" aria-hidden="true" />
                        Connection established
                      </span>
                    )}
                    {isMlDatabaseConnecting ? (
                      <span className="ds-db-selected__loading" role="status">
                        <i aria-hidden="true" />
                        Connecting...
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="ds-db-selected__schema-browser"
                        onClick={onOpenMlDatabaseSchemaBrowser}
                      >
                        Schema
                      </button>
                    )}
                    <button
                      type="button"
                      className="ds-db-selected__change"
                      onClick={onOpenMlDatabasePicker}
                    >
                      Change
                    </button>
                  </span>
                </div>
              ) : (
                <SourceActionField
                  label="Select Database Connection"
                  icon={<SourceTypeIcon name="database" size={20} />}
                  onClick={onOpenMlDatabasePicker}
                />
              )}
            </section>
            {mlSelectedDatabase && !isMlDatabaseConnecting && (
              <QueryEditor value={mlDatabaseQuery} onChange={onMlDatabaseQueryChange} />
            )}
          </>
        )}

        {mlInputSource === "api" && (
          <>
            <section className="ds-config">
              <FieldHeader title="API Request" />
              {mlSelectedApi && mlSelectedApiRequest ? (
                <div className="ds-db-selected">
                  <SourceTypeIcon name="api-request" size={20} />
                  <span className="ds-db-selected__content">
                    <strong>{mlSelectedApiRequest.name}</strong>
                    <small>Collection: {mlSelectedApi.name}</small>
                  </span>
                  <span className="ds-db-selected__trailing">
                    <Globe size={16} aria-hidden="true" />
                  </span>
                  <button type="button" className="ds-db-selected__change" onClick={onOpenMlApiPicker}>
                    Change
                  </button>
                </div>
              ) : (
                <SourceActionField
                  label="Select API Request"
                  icon={<SourceTypeIcon name="api-request" size={20} />}
                  onClick={onOpenMlApiPicker}
                />
              )}
            </section>
            {mlSelectedApi && (
              <ApiRequestPanel
                request={mlSelectedRequest}
                requests={mlSelectedApi.requests}
              />
            )}
          </>
        )}

        {mlInputSource === "file-source" && (
          <>
            <section className="ds-config">
              <FieldHeader title="File Source" />
              {mlSelectedFile ? (
                <div className="ds-db-selected">
                  <SourceTypeIcon name="file" size={20} />
                  <span className="ds-db-selected__content">
                    <strong>{mlSelectedFile.name}</strong>
                    <small>
                      {mlSelectedFile.fileName} · {mlSelectedFile.rows.toLocaleString()} rows
                    </small>
                  </span>
                  <span className="ds-db-selected__trailing">
                    <Database size={16} aria-hidden="true" />
                  </span>
                  <button type="button" className="ds-db-selected__change" onClick={onOpenMlFilePicker}>
                    Change
        </button>
      </div>
              ) : (
                <SourceActionField
                  label="Select File"
                  icon={<SourceTypeIcon name="file" size={20} />}
                  onClick={onOpenMlFilePicker}
                />
              )}
              <p className="ds-config__helper">
                Pick an existing upload or use + New in the picker to upload a file to the store.
              </p>
            </section>
            {mlSelectedFile && <QueryEditor value={mlFileQuery} onChange={onMlFileQueryChange} />}
          </>
        )}

        {mlInputSource === "local-file" && (
          <section className="ds-config">
            <FieldHeader title="Local File" />
            <LocalFileUpload />
          </section>
        )}

        {mlInputSource && (
            <button
              type="button"
            className="ds-ml-run-prediction ds-ml-run-prediction--full"
            disabled
          >
            <Play size={14} weight="fill" aria-hidden="true" />
            Run Prediction
            </button>
        )}
        </div>
    );
  }

  if (sourceType === "marketplace") {
    return (
      <section className="ds-config">
        <FieldHeader title="Marketplace Provider" />
        {selectedMarketplaceProvider ? (
          <div className="ds-db-selected ds-db-selected--no-trailing">
            <SourceTypeIcon name="marketplace" size={20} />
            <span className="ds-db-selected__content">
              <strong>{selectedMarketplaceProvider.name}</strong>
              <small>{selectedMarketplaceProvider.category}</small>
            </span>
            <button
              type="button"
              className="ds-db-selected__change"
              onClick={onOpenMarketplacePicker}
            >
              Change
            </button>
          </div>
        ) : (
          <SourceActionField
            label="Select Marketplace Provider"
            icon={<SourceTypeIcon name="marketplace" size={20} />}
            onClick={onOpenMarketplacePicker}
          />
        )}
      </section>
    );
  }

  const isEtlFlow = sourceType === "etl-flow";
  return (
    <div className="ds-config-stack">
      <section className="ds-config">
        <FieldHeader title={isEtlFlow ? "Select ETL Flow" : "Select Data Flow"} />
        {selectedDataFlow ? (
          <div className="ds-db-selected ds-db-selected--no-trailing">
            <SourceTypeIcon name="etl-flow" size={20} />
            <span className="ds-db-selected__content">
              <strong>{selectedDataFlow.name}</strong>
              <small>{selectedDataFlow.columns.length} columns</small>
            </span>
            <button
              type="button"
              className="ds-db-selected__change"
              onClick={onOpenDataFlowPicker}
            >
              Change
            </button>
          </div>
        ) : (
          <SourceActionField
            label={isEtlFlow ? "Select ETL Flow" : "Select Data Flow"}
            icon={<SourceTypeIcon name="etl-flow" size={20} />}
            onClick={onOpenDataFlowPicker}
          />
        )}
      </section>
      {selectedDataFlow && (
        <QueryEditor value={outputProjection} onChange={onOutputProjectionChange} />
      )}
    </div>
  );
}

export default function DataSourceStep({
  onConfigurationChange,
  onSourceTypeChange,
  onSelectedDatabaseChange,
  onSourceSummaryChange,
  onQueryPreviewChange,
  onLoadingChange,
}: {
  onConfigurationChange?: (configured: boolean) => void;
  onSourceTypeChange?: (selected: boolean) => void;
  onSelectedDatabaseChange?: (databaseId: string | null) => void;
  onSourceSummaryChange?: (summary: DataSourceSummary | null) => void;
  onQueryPreviewChange?: (query: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [mlInputSource, setMlInputSource] = useState<MlInputSource | null>(null);
  const [databasePickerOpen, setDatabasePickerOpen] = useState(false);
  const [databasePickerContext, setDatabasePickerContext] =
    useState<PickerContext>("source");
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [draftDatabaseId, setDraftDatabaseId] = useState<string | null>(null);
  const [apiPickerOpen, setApiPickerOpen] = useState(false);
  const [apiPickerContext, setApiPickerContext] = useState<PickerContext>("source");
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [draftApiId, setDraftApiId] = useState<string | null>(null);
  const [draftApiRequest, setDraftApiRequest] = useState("");
  const [selectedRequest, setSelectedRequest] = useState("");
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [uploadFileModalOpen, setUploadFileModalOpen] = useState(false);
  const [filePickerContext, setFilePickerContext] = useState<PickerContext>("source");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [draftFileId, setDraftFileId] = useState<string | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [mlSelectedDatabaseId, setMlSelectedDatabaseId] = useState<string | null>(null);
  const [mlDatabaseQuery, setMlDatabaseQuery] = useState("");
  const [mlSelectedApiId, setMlSelectedApiId] = useState<string | null>(null);
  const [mlSelectedRequest, setMlSelectedRequest] = useState("");
  const [mlSelectedFileId, setMlSelectedFileId] = useState<string | null>(null);
  const [mlFileQuery, setMlFileQuery] = useState("");
  const [dataFlowPickerOpen, setDataFlowPickerOpen] = useState(false);
  const [selectedDataFlowId, setSelectedDataFlowId] = useState<string | null>(null);
  const [draftDataFlowId, setDraftDataFlowId] = useState<string | null>(null);
  const [outputProjection, setOutputProjection] = useState("");
  const [marketplacePickerOpen, setMarketplacePickerOpen] = useState(false);
  const [selectedMarketplaceProviderId, setSelectedMarketplaceProviderId] = useState<
    string | null
  >(null);
  const [draftMarketplaceProviderId, setDraftMarketplaceProviderId] = useState<
    string | null
  >(null);
  const [query, setQuery] = useState("");
  const [databaseConnecting, setDatabaseConnecting] = useState(false);
  const [mlDatabaseConnecting, setMlDatabaseConnecting] = useState(false);
  const [schemaBrowserDatabase, setSchemaBrowserDatabase] =
    useState<DatabaseConnection | null>(null);
  const selectedDatabase =
    DATABASE_CONNECTIONS.find(
      (connection) => connection.id === selectedDatabaseId && connection.active,
    ) ?? null;
  const selectedApi =
    API_SOURCES.find((source) => source.id === selectedApiId && source.active) ?? null;
  const selectedApiRequest =
    selectedApi?.requests.find((request) => request.id === selectedRequest) ?? null;
  const selectedFile =
    FILE_SOURCES.find((source) => source.id === selectedFileId && source.active) ?? null;
  const mlSelectedDatabase =
    DATABASE_CONNECTIONS.find(
      (connection) => connection.id === mlSelectedDatabaseId && connection.active,
    ) ?? null;
  const mlSelectedApi =
    API_SOURCES.find((source) => source.id === mlSelectedApiId && source.active) ?? null;
  const mlSelectedApiRequest =
    mlSelectedApi?.requests.find((request) => request.id === mlSelectedRequest) ?? null;
  const hasSelectedApiRequest =
    selectedApi?.requests.some((request) => request.id === selectedRequest) ?? false;
  const hasMlSelectedApiRequest =
    mlSelectedApi?.requests.some((request) => request.id === mlSelectedRequest) ?? false;
  const mlSelectedFile =
    FILE_SOURCES.find((source) => source.id === mlSelectedFileId && source.active) ?? null;
  const selectedDataFlow = DATA_FLOWS.find((flow) => flow.id === selectedDataFlowId) ?? null;
  const selectedMarketplaceProvider =
    MARKETPLACE_PROVIDERS.find(
      (provider) => provider.id === selectedMarketplaceProviderId && provider.active,
    ) ?? null;
  const selectedSourceOption =
    SOURCE_TYPES.find((source) => source.id === sourceType) ?? null;
  const hasConfiguredSource =
    (sourceType === "database" && Boolean(selectedDatabase)) ||
    (sourceType === "api" && hasSelectedApiRequest) ||
    (sourceType === "file-upload" && Boolean(selectedFile)) ||
    (sourceType === "ml-model" &&
      Boolean(mlSelectedDatabase || hasMlSelectedApiRequest || mlSelectedFile)) ||
    ((sourceType === "data-flow" || sourceType === "etl-flow") && Boolean(selectedDataFlow)) ||
    (sourceType === "marketplace" && Boolean(selectedMarketplaceProvider));
  const shouldFillQuery =
    (sourceType === "database" && Boolean(selectedDatabase)) ||
    (sourceType === "file-upload" && Boolean(selectedFile)) ||
    ((sourceType === "data-flow" || sourceType === "etl-flow") &&
      Boolean(selectedDataFlow)) ||
    (sourceType === "ml-model" &&
      ((mlInputSource === "database" && Boolean(mlSelectedDatabase)) ||
        (mlInputSource === "file-source" && Boolean(mlSelectedFile))));
  const activeQueryPreview =
    sourceType === "database"
      ? query
      : sourceType === "file-upload"
        ? fileQuery
        : sourceType === "ml-model" && mlInputSource === "database"
          ? mlDatabaseQuery
          : sourceType === "ml-model" && mlInputSource === "file-source"
            ? mlFileQuery
            : sourceType === "data-flow" || sourceType === "etl-flow"
              ? outputProjection
              : "";

  useEffect(() => {
    onConfigurationChange?.(hasConfiguredSource);
  }, [hasConfiguredSource, onConfigurationChange]);

  useEffect(() => {
    onSourceTypeChange?.(Boolean(sourceType));
  }, [onSourceTypeChange, sourceType]);

  useEffect(() => {
    onSelectedDatabaseChange?.(
      sourceType === "database" ? selectedDatabaseId : null,
    );
  }, [onSelectedDatabaseChange, selectedDatabaseId, sourceType]);

  useEffect(() => {
    let summary: DataSourceSummary | null = null;
    if (sourceType === "database" && selectedDatabase) {
      summary = {
        type: "Database",
        name: selectedDatabase.name,
        detail: selectedDatabase.description || selectedDatabase.schema,
      };
    } else if (sourceType === "api" && selectedApi && selectedApiRequest) {
      summary = {
        type: "API Request",
        name: selectedApiRequest.name,
        detail: `${selectedApiRequest.method} ${selectedApiRequest.endpoint} · ${selectedApi.name}`,
      };
    } else if (sourceType === "file-upload" && selectedFile) {
      summary = {
        type: "File",
        name: selectedFile.name,
        detail: `${selectedFile.fileName} · ${selectedFile.rows.toLocaleString()} rows`,
      };
    } else if (
      (sourceType === "data-flow" || sourceType === "etl-flow") &&
      selectedDataFlow
    ) {
      summary = {
        type: sourceType === "etl-flow" ? "ETL Flow" : "Data Flow",
        name: selectedDataFlow.name,
        detail: selectedDataFlow.description,
      };
    } else if (sourceType === "marketplace" && selectedMarketplaceProvider) {
      summary = {
        type: "Marketplace",
        name: selectedMarketplaceProvider.name,
        detail: selectedMarketplaceProvider.description,
      };
    } else if (sourceType === "ml-model") {
      if (mlInputSource === "database" && mlSelectedDatabase) {
        summary = {
          type: "ML Model · Database",
          name: mlSelectedDatabase.name,
          detail: mlSelectedDatabase.description || mlSelectedDatabase.schema,
        };
      } else if (
        mlInputSource === "api" &&
        mlSelectedApi &&
        mlSelectedApiRequest
      ) {
        summary = {
          type: "ML Model · API Request",
          name: mlSelectedApiRequest.name,
          detail: `${mlSelectedApiRequest.method} ${mlSelectedApiRequest.endpoint} · ${mlSelectedApi.name}`,
        };
      } else if (mlInputSource === "file-source" && mlSelectedFile) {
        summary = {
          type: "ML Model · File",
          name: mlSelectedFile.name,
          detail: mlSelectedFile.fileName,
        };
      }
    }
    onSourceSummaryChange?.(summary);
  }, [
    mlInputSource,
    mlSelectedApi,
    mlSelectedApiRequest,
    mlSelectedDatabase,
    mlSelectedFile,
    onSourceSummaryChange,
    selectedApi,
    selectedApiRequest,
    selectedDataFlow,
    selectedDatabase,
    selectedFile,
    selectedMarketplaceProvider,
    sourceType,
  ]);

  useEffect(() => {
    onQueryPreviewChange?.(activeQueryPreview);
  }, [activeQueryPreview, onQueryPreviewChange]);

  useEffect(() => {
    onLoadingChange?.(databaseConnecting || mlDatabaseConnecting);
  }, [databaseConnecting, mlDatabaseConnecting, onLoadingChange]);

  useEffect(() => {
    if (selectedDatabaseId) {
      setQuery((current) => current.trim() ? current : DEFAULT_DATABASE_QUERY);
    }
  }, [selectedDatabaseId]);

  useEffect(() => {
    if (!selectedDatabaseId || sourceType !== "database") {
      setDatabaseConnecting(false);
      return;
    }

    setDatabaseConnecting(true);
    const timer = window.setTimeout(() => setDatabaseConnecting(false), 1400);
    return () => window.clearTimeout(timer);
  }, [selectedDatabaseId, sourceType]);

  useEffect(() => {
    if (mlSelectedDatabaseId) {
      setMlDatabaseQuery((current) => current.trim() ? current : DEFAULT_DATABASE_QUERY);
    }
  }, [mlSelectedDatabaseId]);

  useEffect(() => {
    if (
      !mlSelectedDatabaseId ||
      sourceType !== "ml-model" ||
      mlInputSource !== "database"
    ) {
      setMlDatabaseConnecting(false);
      return;
    }

    setMlDatabaseConnecting(true);
    const timer = window.setTimeout(() => setMlDatabaseConnecting(false), 1400);
    return () => window.clearTimeout(timer);
  }, [mlInputSource, mlSelectedDatabaseId, sourceType]);

  const openDatabasePickerFor = (context: PickerContext) => {
    setDatabasePickerContext(context);
    setDraftDatabaseId(context === "ml" ? mlSelectedDatabaseId : selectedDatabaseId);
    setDatabasePickerOpen(true);
  };
  const openDatabasePicker = () => openDatabasePickerFor("source");
  const openMlDatabasePicker = () => openDatabasePickerFor("ml");

  const openApiPickerFor = (context: PickerContext) => {
    setApiPickerContext(context);
    setDraftApiId(context === "ml" ? mlSelectedApiId : selectedApiId);
    setDraftApiRequest(context === "ml" ? mlSelectedRequest : selectedRequest);
    setApiPickerOpen(true);
  };
  const openApiPicker = () => openApiPickerFor("source");
  const openMlApiPicker = () => openApiPickerFor("ml");

  const openFilePickerFor = (context: PickerContext) => {
    setFilePickerContext(context);
    setDraftFileId(context === "ml" ? mlSelectedFileId : selectedFileId);
    setFilePickerOpen(true);
  };
  const openFilePicker = () => openFilePickerFor("source");
  const openMlFilePicker = () => openFilePickerFor("ml");
  const openDataFlowPicker = () => {
    setDraftDataFlowId(selectedDataFlowId);
    setDataFlowPickerOpen(true);
  };
  const openMarketplacePicker = () => {
    setDraftMarketplaceProviderId(selectedMarketplaceProviderId);
    setMarketplacePickerOpen(true);
  };

  const clearSourceSelections = () => {
    setSelectedDatabaseId(null);
    setDraftDatabaseId(null);
    setQuery("");
    setSelectedApiId(null);
    setDraftApiId(null);
    setDraftApiRequest("");
    setSelectedRequest("");
    setSelectedFileId(null);
    setDraftFileId(null);
    setFileQuery("");
    setMlInputSource(null);
    setMlSelectedDatabaseId(null);
    setMlDatabaseQuery("");
    setMlSelectedApiId(null);
    setMlSelectedRequest("");
    setMlSelectedFileId(null);
    setMlFileQuery("");
    setSelectedDataFlowId(null);
    setDraftDataFlowId(null);
    setOutputProjection("");
    setSelectedMarketplaceProviderId(null);
    setDraftMarketplaceProviderId(null);
  };

  const pickerModal = databasePickerOpen ? (
    <SourcePickerModal
      variant="database"
      onClose={() => setDatabasePickerOpen(false)}
    >
        <DatabaseConnectionPicker
          selectedId={draftDatabaseId}
          onChange={setDraftDatabaseId}
          onCancel={() => setDatabasePickerOpen(false)}
          onSelect={() => {
            if (!draftDatabaseId) return;
            if (databasePickerContext === "ml") {
              setMlSelectedDatabaseId(draftDatabaseId);
            } else {
              setSelectedDatabaseId(draftDatabaseId);
            }
            setDatabasePickerOpen(false);
          }}
        />
    </SourcePickerModal>
  ) : apiPickerOpen ? (
    <SourcePickerModal variant="api" onClose={() => setApiPickerOpen(false)}>
        <ApiSourcePicker
          selectedId={draftApiId}
          selectedRequestId={draftApiRequest}
          onChange={(collectionId, requestId) => {
            setDraftApiId(collectionId);
            setDraftApiRequest(requestId);
          }}
          onCancel={() => setApiPickerOpen(false)}
          onSelect={() => {
            if (!draftApiId || !draftApiRequest) return;
            if (apiPickerContext === "ml") {
              setMlSelectedApiId(draftApiId);
              setMlSelectedRequest(draftApiRequest);
            } else {
              setSelectedApiId(draftApiId);
              setSelectedRequest(draftApiRequest);
            }
            setApiPickerOpen(false);
          }}
        />
    </SourcePickerModal>
  ) : uploadFileModalOpen ? (
    <SourcePickerModal
      variant="upload-file"
      onClose={() => setUploadFileModalOpen(false)}
    >
      <UploadFileModal onClose={() => setUploadFileModalOpen(false)} />
    </SourcePickerModal>
  ) : filePickerOpen ? (
    <SourcePickerModal variant="file" onClose={() => setFilePickerOpen(false)}>
        <FileSourcePicker
          selectedId={draftFileId}
          onChange={setDraftFileId}
          onCancel={() => setFilePickerOpen(false)}
          onUploadNewFile={() => setUploadFileModalOpen(true)}
          onSelect={() => {
            if (!draftFileId) return;
            const file = FILE_SOURCES.find((source) => source.id === draftFileId);
            const nextQuery = file ? `SELECT * FROM ${file.tableName} LIMIT 50000;` : "";
            if (filePickerContext === "ml") {
              setMlSelectedFileId(draftFileId);
              setMlFileQuery(nextQuery);
            } else {
              setSelectedFileId(draftFileId);
              setFileQuery(nextQuery);
            }
            setFilePickerOpen(false);
          }}
        />
    </SourcePickerModal>
  ) : marketplacePickerOpen ? (
    <SourcePickerModal variant="marketplace" onClose={() => setMarketplacePickerOpen(false)}>
      <MarketplaceProviderPicker
        selectedId={draftMarketplaceProviderId}
        onChange={setDraftMarketplaceProviderId}
        onCancel={() => setMarketplacePickerOpen(false)}
        onSelect={() => {
          if (!draftMarketplaceProviderId) return;
          setSelectedMarketplaceProviderId(draftMarketplaceProviderId);
          setMarketplacePickerOpen(false);
        }}
      />
    </SourcePickerModal>
  ) : dataFlowPickerOpen ? (
    <SourcePickerModal variant="data-flow" onClose={() => setDataFlowPickerOpen(false)}>
        <DataFlowPicker
          selectedId={draftDataFlowId}
          flowMode={sourceType === "etl-flow" ? "etl-flow" : "data-flow"}
          onChange={setDraftDataFlowId}
          onCancel={() => setDataFlowPickerOpen(false)}
          onSelect={() => {
            if (!draftDataFlowId) return;
            setSelectedDataFlowId(draftDataFlowId);
            const flow = DATA_FLOWS.find((item) => item.id === draftDataFlowId);
            setOutputProjection(
              flow ? `SELECT\n  ${flow.columns.join(",\n  ")}\nFROM flow;` : "",
            );
            setDataFlowPickerOpen(false);
          }}
        />
    </SourcePickerModal>
  ) : null;

  return (
    <>
      <div className={"ds-step" + (shouldFillQuery ? " ds-step--query-fill" : "")}>
        {selectedSourceOption ? (
          <section
            className="ds-selected-source-type"
            aria-labelledby="ds-selected-source-type-label"
          >
            <h3 id="ds-selected-source-type-label">Selected Source Type</h3>
            <div className="ds-selected-source-type__card">
              <span className="ds-selected-source-type__icon">{selectedSourceOption.icon}</span>
              <strong>{selectedSourceOption.title}</strong>
              <button
                type="button"
                onClick={() => {
                  clearSourceSelections();
                  setSourceType(null);
                  setDatabasePickerOpen(false);
                  setApiPickerOpen(false);
                  setFilePickerOpen(false);
                  setUploadFileModalOpen(false);
                  setDataFlowPickerOpen(false);
                  setMarketplacePickerOpen(false);
                }}
              >
                Change
              </button>
              </div>
            </section>
        ) : (
          <section className="ds-source-types" aria-labelledby="ds-source-types-label">
            <h3 id="ds-source-types-label" className="ds-source-types__label">
              Select Source Type
            </h3>
            <div className="ds-source-types__grid">
              {SOURCE_TYPES.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className="ds-source-type-card"
                  aria-pressed="false"
                  onClick={() => {
                    clearSourceSelections();
                    setSourceType(source.id);
                    setDatabasePickerOpen(false);
                    setApiPickerOpen(false);
                    setFilePickerOpen(false);
                    setUploadFileModalOpen(false);
                    setDataFlowPickerOpen(false);
                    setMarketplacePickerOpen(false);
                  }}
                >
                  <span className="ds-source-type-card__icon">{source.icon}</span>
                  <span className="ds-source-type-card__content">
                    <strong>{source.title}</strong>
                    <span>{source.description}</span>
                  </span>
                </button>
              ))}
          </div>
          </section>
        )}

        {sourceType && (
          <SourceConfiguration
            sourceType={sourceType}
            mlInputSource={mlInputSource}
            onMlInputSourceChange={setMlInputSource}
            selectedDatabase={selectedDatabase}
            isDatabaseConnecting={databaseConnecting}
            onOpenDatabasePicker={openDatabasePicker}
            onOpenDatabaseSchemaBrowser={() => setSchemaBrowserDatabase(selectedDatabase)}
            selectedApi={selectedApi}
            onOpenApiPicker={openApiPicker}
            selectedRequest={selectedRequest}
            selectedFile={selectedFile}
            onOpenFilePicker={openFilePicker}
            onOpenFileSchemaBrowser={() => {
              if (!selectedFile) return;
              setSchemaBrowserDatabase({
                id: `file-${selectedFile.id}`,
                name: selectedFile.name,
                description: selectedFile.fileName,
                schema: selectedFile.tableName,
                active: selectedFile.active,
              });
            }}
            fileQuery={fileQuery}
            onFileQueryChange={setFileQuery}
            mlSelectedDatabase={mlSelectedDatabase}
            isMlDatabaseConnecting={mlDatabaseConnecting}
            onOpenMlDatabasePicker={openMlDatabasePicker}
            onOpenMlDatabaseSchemaBrowser={() => setSchemaBrowserDatabase(mlSelectedDatabase)}
            mlDatabaseQuery={mlDatabaseQuery}
            onMlDatabaseQueryChange={setMlDatabaseQuery}
            mlSelectedApi={mlSelectedApi}
            onOpenMlApiPicker={openMlApiPicker}
            mlSelectedRequest={mlSelectedRequest}
            mlSelectedFile={mlSelectedFile}
            onOpenMlFilePicker={openMlFilePicker}
            mlFileQuery={mlFileQuery}
            onMlFileQueryChange={setMlFileQuery}
            selectedDataFlow={selectedDataFlow}
            onOpenDataFlowPicker={openDataFlowPicker}
            outputProjection={outputProjection}
            onOutputProjectionChange={setOutputProjection}
            selectedMarketplaceProvider={selectedMarketplaceProvider}
            onOpenMarketplacePicker={openMarketplacePicker}
            query={query}
            onQueryChange={setQuery}
          />
        )}
    </div>
      {pickerModal}
      {schemaBrowserDatabase && (
        <SourcePickerModal
          variant="schema-browser"
          onClose={() => setSchemaBrowserDatabase(null)}
        >
          <DatabaseSchemaBrowser
            database={schemaBrowserDatabase}
            onClose={() => setSchemaBrowserDatabase(null)}
          />
        </SourcePickerModal>
      )}
    </>
  );
}
