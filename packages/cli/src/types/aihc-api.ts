/**
 * AIHC API Response Types
 * Based on AIHC API documentation
 */

// ============= Common Types =============

export interface AcceleratorCard {
  acceleratorType: string;
  acceleratorCount: string | number;
  acceleratorDescription?: string;
  description?: string;
}

export interface ResourceAmount {
  cpuCores?: string;
  milliCPUcores?: string;
  memoryGi?: string;
  acceleratorCardList?: AcceleratorCard[];
}

// ============= Dataset Types (获取数据集列表.md) =============

export interface Dataset {
  id: string;
  name: string;
  storageType: string;
  storageInstance: string;
  importFormat: string;
  description?: string;
  owner: string;
  ownerName: string;
  visibilityScope: string;
  permission: string;
  latestVersionId?: string;
  latestVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DescribeDatasetsResponse {
  requestId: string;
  totalCount: number;
  datasets: Dataset[];
}

// ============= Model Types (获取模型列表.md) =============

export interface Model {
  id: string;
  name: string;
  initSource: string;
  latestVersion?: string;
  latestVersionId?: string;
  modelFormat: string;
  description?: string;
  updatedAt: string;
  createdAt: string;
  owner: string;
  ownerName: string;
  visibilityScope: string;
  tags?: Record<string, unknown>;
}

export interface DescribeModelsResponse {
  requestId: string;
  totalCount: number;
  models: Model[];
}

// ============= Dev Instance Types (查询开发机列表.md) =============

export interface DevInstanceResources {
  acceleratorCount: number;
  acceleratorType: string;
  cpus: number;
  memory: number;
  shmSize: number;
}

export interface DevInstance {
  accountId: string;
  id: string;
  name: string;
  creator: string;
  creatorId: string;
  region: string;
  status: number;
  statusReason?: string;
  version?: string;
  createdAt: number;
  updatedAt: number;
  queueName?: string;
  resourcePoolId?: string;
  resourcePoolName?: string;
  imageUrl?: string;
  resources?: DevInstanceResources;
}

export interface DescribeDevInstancesResponse {
  requestId?: string;
  totalCount?: number;
  devInstances: DevInstance[];
}

// ============= Service Types (拉取服务列表.md) =============

export interface ResourceSpec {
  cpus?: number;
  memory?: number;
  acceleratorCount?: number;
  acceleratorType?: string;
}

export interface ServiceBriefInfo {
  id: string;
  name: string;
  resourcePoolId: string;
  resourcePoolName?: string;
  queueName: string;
  region: string;
  publicAccess?: boolean;
  creator?: string;
  networkType?: string;
  createdAt: number;
  updatedAt: number;
  resourcePoolType?: string;
  workloadType?: string;
  resourceSpec?: ResourceSpec;
  hpa?: Record<string, unknown>;
}

export interface DescribeServicesResponse {
  requestId: string;
  totalCount: number;
  services: ServiceBriefInfo[];
  pageNumber?: number;
  pageSize?: number;
  orderBy?: string;
  order?: string;
}

// ============= Resource Pool Types (查询资源池列表.md) =============

export interface NetworkInfo {
  region?: string;
  vpcId?: string;
  vpcUuid?: string;
  vpcCidr?: string;
  subnetIDs?: string[];
  subnetIds?: string[];
  subnetCidr?: string;
}

export interface Network {
  mode?: string;
  master?: NetworkInfo | NetworkInfo[];
  nodes?: NetworkInfo | NetworkInfo[];
  pods?: NetworkInfo | NetworkInfo[];
  clusterIPCidr?: string;
  loadBalanceService?: NetworkInfo | NetworkInfo[];
  maxPodsPerNode?: number;
}

export interface AssociateResource {
  provider: string;
  id: string;
  uuid?: string;
  region: string;
  zone?: string;
}

export interface Configuration {
  exposedPublic?: boolean;
  forbidDelete?: boolean;
  deschedulerEnabled?: boolean;
  unifiedSchedulerEnabled?: boolean;
  datasetPermissionEnabled?: boolean;
  volumePermissionEnabled?: boolean;
  imageNoAuthPullEnabled?: boolean;
  publicNetInferenceServiceEnable?: boolean;
}

export interface ResourcePoolSpec {
  region: string;
  resourcePoolId: string;
  type: string;
  name: string;
  description?: string;
  exposedPublic?: boolean;
  forbidDelete?: boolean;
  deschedulerEnabled?: boolean;
  unifiedSchedulerEnabled?: boolean;
  associatedResources?: AssociateResource[];
  network?: Network;
  phase: string;
  nodeNum: number;
  k8sVersion?: string;
  runtimeType?: string;
  runtimeVersion?: string;
  runtime?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creator?: string;
  configuration?: Configuration;
}

export interface DescribeResourcePoolsResponse {
  requestId: string;
  totalCount: number;
  resourcePools: ResourcePoolSpec[];
  keywordType?: string;
  keyword?: string;
  orderBy?: string;
  order?: string;
  pageNumber?: number;
  pageSize?: number;
}

// ============= Queue Types (查询队列列表.md) =============

export interface QueueItem {
  queueId: string;
  queueName: string;
  queueType: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  resourcePoolId: string;
  parentQueue?: string;
  children?: QueueItem[];
  opened: boolean;
  reclaimable: boolean;
  preemptable?: boolean;
  disableOversell?: boolean;
  queueingStrategy?: string;
  enableVGPU?: boolean;
  capability?: ResourceAmount;
  deserved?: ResourceAmount;
  guarantee?: ResourceAmount;
  allocated?: ResourceAmount;
  workloadAvailable?: ResourceAmount;
  remaining?: ResourceAmount;
  runningJobs?: number;
  inqueueJobs?: number;
  pendingJobs?: number;
}

export interface DescribeQueuesResponse {
  requestId?: string;
  totalCount: number;
  queues: QueueItem[];
  keywordType?: string;
  keyword?: string;
  pageNumber?: number;
  pageSize?: number;
}

// ============= Job Types (查询训练任务列表.md) =============

export interface Env {
  name: string;
  value: string;
}

export interface Resource {
  name: string;
  quantity: string | number;
}

export interface ImageConfig {
  username?: string;
  password?: string;
}

export interface JobSpec {
  image: string;
  imageConfig?: ImageConfig;
  replicas: number;
  resources?: Resource[];
  envs?: Env[];
  enableRDMA?: boolean;
  hostNetwork?: boolean;
}

export interface Label {
  key: string;
  value: string;
}

export interface DataSource {
  type: string;
  name: string;
  sourcePath?: string;
  mountPath: string;
  options?: {
    sizeLimit?: number;
    medium?: string;
    readOnly?: boolean;
  };
}

export interface JobItem {
  jobId: string;
  jobid?: string; // Some APIs use 'jobid' instead of 'jobId'
  userId: string;
  name: string;
  status: string;
  jobType: string;
  resourcePoolId: string;
  queue?: string;
  queueId?: string;
  jobSpec?: JobSpec;
  command?: string;
  labels?: Label[];
  priority?: string;
  dataSources?: DataSource[];
  enableBccl?: boolean;
  enableBcclStatus?: string;
  enableBcclErrorReason?: string;
  enableFaultTolerant?: boolean;
  faultTolerantArgs?: string;
  createdAt: string;
  finishedAt?: string;
  replicas?: number;
}

export interface DescribeJobsResponse {
  requestId: string;
  totalCount: number;
  jobs: JobItem[];
}

// ============= Error Response =============

export interface ErrorResponse {
  code: string;
  message: string;
  request_id?: string;
  requestId?: string;
}

// ============= BCE SDK Response Wrapper =============

export interface BceSdkResponse<T> {
  http_headers: Record<string, string>;
  body: T;
}

