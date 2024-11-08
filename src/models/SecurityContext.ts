/**
 * Specifies security settings for a Kubernetes container, controlling user and group IDs under which the container's processes run.
 * `SecurityContext` settings help enforce security policies within containers.
 */
export interface SecurityContext {
  /**
   * The user ID to run the container's processes as.
   * This helps define the ownership and permissions of files within the container and restricts access according to user privileges.
   *
   * @example
   * runAsUser: 1000
   */
  runAsUser?: number;

  /**
   * The primary group ID to run the container's processes as.
   * This determines group ownership and permissions for files and processes within the container.
   *
   * @example
   * runAsGroup: 3000
   */
  runAsGroup?: number;

  /**
   * The group ID that should own any files created by the container.
   * Typically used for setting permissions on shared storage volumes, enabling multiple containers to access files as the same group.
   *
   * @example
   * fsGroup: 2000
   */
  fsGroup?: number;
}
