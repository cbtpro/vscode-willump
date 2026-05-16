import { Notification } from '@arco-design/web-vue';
import type { Ref } from 'vue';
import { watch } from 'vue';

type NotificationTitle = string | (() => string);

interface StatusNotificationOptions {
	title: NotificationTitle;
	successMessage: Ref<string>;
	errorMessage: Ref<string>;
}

function resolveTitle(title: NotificationTitle) {
	return typeof title === 'function' ? title() : title;
}

export default function useStatusNotifications({ title, successMessage, errorMessage }: StatusNotificationOptions) {
	watch(successMessage, message => {
		if (!message) {
			return;
		}

		Notification.success({
			title: resolveTitle(title),
			content: message,
			closable: true
		});
	});

	watch(errorMessage, message => {
		if (!message) {
			return;
		}

		Notification.error({
			title: resolveTitle(title),
			content: message,
			closable: true
		});
	});
}
