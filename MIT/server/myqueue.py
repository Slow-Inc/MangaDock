import asyncio
from typing import List, Optional

from PIL import Image
from fastapi import HTTPException
from fastapi.requests import Request

from manga_translator import Config
from server.instance import executor_instances
from server.sent_data_internal import NotifyType

class QueueElement:
    req: Request
    image: Image.Image
    config: Config
    task_type: str

    def __init__(self, req: Request, image: Image.Image, config: Config, length, task_type: str = "translate", progress_meta: dict | None = None):
        self.req = req
        self.image = image
        self.config = config
        self.task_type = task_type
        # Optional {url, secret, taskId, pageIndex} — the worker forwards live
        # pipeline-stage events to this webhook while translating (UX).
        self.progress_meta = progress_meta

    async def is_client_disconnected(self) -> bool:
        if await self.req.is_disconnected():
            return True
        return False


class TaskQueue:
    def __init__(self):
        self.queue: List[QueueElement] = []
        self.queue_event: asyncio.Event = asyncio.Event()

    def add_task(self, task: QueueElement):
        self.queue.append(task)

    def get_pos(self, task: QueueElement) -> Optional[int]:
        try:
            return self.queue.index(task)
        except ValueError:
            return None

    async def update_event(self):
        self.queue = [task for task in self.queue if not await task.is_client_disconnected()]
        self.queue_event.set()
        self.queue_event.clear()

    async def remove(self, task: QueueElement):
        self.queue.remove(task)
        await self.update_event()

    async def wait_for_event(self):
        await self.queue_event.wait()

task_queue = TaskQueue()

async def wait_in_queue(task: QueueElement, notify: NotifyType):
    """Will get task position report it. If its in the range of translators then it will try to aquire an instance(blockig) and sent a task to it. when done the item will be removed from the queue and result will be returned"""
    while True:
        queue_pos = task_queue.get_pos(task)
        if queue_pos is None:
            if notify:
                return None
            else:
                raise HTTPException(500, detail="User is no longer connected")  # just for the logs
        if notify:
            notify(3, str(queue_pos).encode('utf-8'))
        if queue_pos < executor_instances.free_executors():
            if await task.is_client_disconnected():
                await task_queue.update_event()
                if notify:
                    return None
                else:
                    raise HTTPException(500, detail="User is no longer connected") #just for the logs

            instance = await executor_instances.find_executor()
            await task_queue.remove(task)
            if notify:
                notify(4, b"")

            try:
                if notify:
                    await instance.sent_stream(task.image, task.config, notify)
                else:
                    if task.task_type == "translate_patches":
                        result = await instance.sent_patches(task.image, task.config, task.progress_meta)
                    else:
                        result = await instance.sent(task.image, task.config)

                if notify:
                    return None
                else:
                    return result

            except Exception as e:
                # 如果是连接错误，发送友好的错误消息
                if "Cannot connect to host" in str(e) or "Connection refused" in str(e):
                    error_msg = "Translation service is starting up, please wait a moment and try again."
                else:
                    error_msg = f"Translation failed: {str(e)}"

                if notify:
                    notify(2, error_msg.encode('utf-8'))
                    return None
                else:
                    raise HTTPException(500, detail=error_msg)

            finally:
                # Always free the executor, even on CancelledError (BaseException).
                # Without this, aborting a batch leaves the executor stuck busy=True forever.
                await executor_instances.free_executor(instance)
        else:
            await task_queue.wait_for_event()