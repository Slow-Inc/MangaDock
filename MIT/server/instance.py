import time
from asyncio import Event, Lock
from typing import List

from PIL import Image
from pydantic import BaseModel

from manga_translator import Config
from server.sent_data_internal import fetch_batch_data, fetch_data_stream, NotifyType, fetch_data
from server.worker_plan import card_key, pick_worker_slot

class ExecutorInstance(BaseModel):
    ip: str
    port: int
    busy: bool = False
    # Dev console (#279): worker reports its os.getpid() at registration; the parent
    # stamps registered_at so the /status snapshot can show real worker PID + uptime.
    pid: int | None = None
    registered_at: float | None = None
    # #1119: the worker's CUDA_VISIBLE_DEVICES, so dispatch can spread pages over GPUs.
    device: str | None = None
    # #1123: pages this worker runs at once (MIT_WORKER_SLOTS) and how many are in flight; busy = no free slot.
    slots: int = 1
    in_flight: int = 0

    def free_executor(self):
        self.in_flight = max(0, self.in_flight - 1)
        self.busy = self.in_flight >= self.slots

    async def sent(self, image: Image, config: Config):
        return await fetch_data("http://"+self.ip+":"+str(self.port)+"/simple_execute/translate", image, config)

    async def sent_patches(self, image: Image, config: Config, progress_meta: dict | None = None):
        return await fetch_data("http://"+self.ip+":"+str(self.port)+"/simple_execute/translate_patches", image, config, progress_meta=progress_meta)

    async def sent_batch_pipeline(self, images: "list[Image]", config: Config):
        """#905: run a whole batch on this worker with the cross-page pipeline overlapped."""
        return await fetch_batch_data("http://" + self.ip + ":" + str(self.port) + "/simple_execute/translate_batch_pipeline",
                                      images, config)

    async def sent_stream(self, image: Image, config: Config, sender: NotifyType):
        await fetch_data_stream("http://"+self.ip+":"+str(self.port)+"/execute/translate", image, config, sender)


class Executors:
    def __init__(self):
        self.list: List[ExecutorInstance] = []
        self.lock: Lock = Lock()
        self.event = Event()

    def register(self, instance: ExecutorInstance):
        instance.registered_at = time.monotonic()
        self.list.append(instance)

    def unregister(self, port: int) -> bool:
        """Drop the worker on ``port`` from dispatch (#1118 review: it died); True when one was removed."""
        before = len(self.list)
        self.list = [x for x in self.list if x.port != port]
        return len(self.list) != before

    def detail_raws(self) -> List[dict]:
        """Plain dicts for server.worker_view (keeps the pure transform import-light)."""
        return [{"ip": i.ip, "port": i.port, "pid": i.pid, "busy": i.busy,
                 "registered_at": i.registered_at, "device": i.device} for i in self.list]

    def free_executors(self) -> int:
        """Free slots across workers (#1123; one per idle worker when every worker has one slot)."""
        return sum(max(0, item.slots - item.in_flight) for item in self.list)

    async def find_executor(self) -> ExecutorInstance:
        while True:
            async with self.lock:
                index = pick_worker_slot([(x.in_flight, x.slots, card_key(x.ip, x.device)) for x in self.list])
                if index is not None:
                    instance = self.list[index]
                    instance.in_flight += 1
                    instance.busy = instance.in_flight >= instance.slots
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
