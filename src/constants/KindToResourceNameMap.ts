/**
 * A mapping of Kubernetes/Tekton resource kinds to their corresponding plural resource names.
 *
 * This constant is used to translate singular kind names used in Kubernetes manifests
 * to their respective plural forms, which are typically used in API endpoints and other
 * resource identifiers.
 *
 * @constant
 */
export const KindToResourceNameMap = {
  /**
   * Represents Kubernetes resource kinds and their corresponding plural resource names.
   */

  Pod: 'pods',
  Service: 'services',
  Deployment: 'deployments',
  ReplicaSet: 'replicasets',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  Ingress: 'ingresses',
  Policy: 'policies',
  Status: 'status',
  Endpoint: 'endpoints',
  Node: 'nodes',
  Namespace: 'namespaces',
  Job: 'jobs',
  CronJob: 'cronjobs',
  PersistentVolume: 'persistentvolumes',
  PersistentVolumeClaim: 'persistentvolumeclaims',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
  HorizontalPodAutoscaler: 'horizontalpodautoscalers',
  ServiceAccount: 'serviceaccounts',
  ClusterRole: 'clusterroles',
  ClusterRoleBinding: 'clusterrolebindings',
  Role: 'roles',
  RoleBinding: 'rolebindings',
  NetworkPolicy: 'networkpolicies',

  /**
   * Represents Tekton resource kinds and their corresponding plural resource names.
   */
  Task: 'tasks',
  TaskRun: 'taskruns',
  Pipeline: 'pipelines',
  PipelineRun: 'pipelineruns',
  ClusterTask: 'clustertasks',
};
