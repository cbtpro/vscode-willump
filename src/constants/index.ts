export enum Commands {
	/**
	 * 检查端口是否被占用。
	 */
	CHECK_PORT = 'willump.checkPort',
	/**
	 * 终止指定端口的进程。
	 */
	KILL_PORT = 'willump.killPort',
	/**
	 * 列出所有被占用的端口。
	 */
	LIST_ALL_PORTS = 'willump.listPorts',
	/**
	 * 查看所有被占用的端口。
	 */
	VIEW_PORTS = 'willump.viewPorts',
	/**
	 * 打开端口占用情况。
	 */
	OPEN_PORT = 'willump.openPort',
	/**
	 * 重启端口。
	 */
	RESTART_PORT = 'willump.restartPort'
}
