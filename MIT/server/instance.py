from asyncio import Event, Lock
from typing import List

from PIL import Image
from pydantic import BaseModel

from manga_translator import Config
from server.sent_data_internal import fetch_data_stream, NotifyType, fetch_data

class ExecutorInstance(BaseModel):
    ip: str
    port: int
    busy: bool = False

    def free_executor(self):
        self.busy = False

    async def sent(self, image: Image, config: Config):
        return await fetch_data("http://"+self.ip+":"+str(self.port)+"/simple_execute/translate", image, config)

    async def sent_patches(self, image: Image, config: Config, progress_meta: dict | None = None):
        return await fetch_data("http://"+self.ip+":"+str(self.port)+"/simple_execute/translate_patches", image, config, progress_meta=progress_meta)

    async def sent_stream(self, image: Image, config: Config, sender: NotifyType):
        await fetch_data_stream("http://"+self.ip+":"+str(self.port)+"/execute/translate", image, config, sender)


class Executors:
    def __init__(self):
        self.list: List[ExecutorInstance] = []
        self.lock: Lock = Lock()
        self.event = Event()

    def register(self, instance: ExecutorInstance):
        self.list.append(instance)

    def free_executors(self) -> int:
        return len([item for item in self.list if not item.busy])

    async def find_executor(self) -> ExecutorInstance:
        while True:
            async with self.lock:
                instance = next((x for x in self.list if not x.busy), None)
                if instance is not None:
                    instance.busy = True
                    return instance
            # Release lock before waiting — concurrent callers must not
            # serialize on the lock while all executors are busy (#106).
            await self.event.wait()

    async def free_executor(self, instance: ExecutorInstance):
        from server.myqueue import task_queue
        instance.free_executor()
        self.event.set()
        self.event.clear()
        await task_queue.update_event()

executor_instances: Executors = Executors()
