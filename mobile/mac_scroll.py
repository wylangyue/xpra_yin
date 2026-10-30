"""Bound both individual deltas and sustained Mac wheel velocity."""
import math
import os
import time
from xpra.os_util import gi_import
from xpra.client.gtk3.window import pointer
from xpra.client.subsystem.window import wheel
from xpra.log import Logger
Gdk = gi_import('Gdk')
try:
    SPEED = float(os.environ.get('TOKYO_SCROLL_SPEED', '0.12'))
    if not math.isfinite(SPEED) or not 0.05 <= SPEED <= 2:
        raise ValueError()
except ValueError:
    SPEED = 0.12
wheel.MOUSE_SCROLL_SQRT_SCALE = False
original = pointer.PointerWindow._do_scroll_event

class ScrollBudget:
    """Discard excess motion rather than queueing a delayed scroll tail.

    Units are remote wheel notches, independently for each axis. A short
    burst remains responsive; sustained input cannot exceed three notches/s.
    """
    def __init__(self):
        self.axes = {}

    def limit(self, axis, delta, now):
        if not delta or not math.isfinite(delta):
            return 0.0, False
        sign = 1 if delta > 0 else -1
        last, tokens, oldsign = self.axes.get(axis, (now, 0.35, sign))
        changed = sign != oldsign
        tokens = min(0.35, tokens + max(0, now-last)*3.0)
        amount = min(abs(delta), tokens)
        self.axes[axis] = (now, tokens-amount, sign)
        return sign*amount, changed or now-last > 0.5

def scroll(self, event):
    if self._client.readonly or self._client.server_readonly or not self._client.server_pointer:
        return True
    if event.direction == Gdk.ScrollDirection.SMOOTH:
        x = max(-2.0, min(2.0, event.delta_x))*SPEED
        y = -max(-2.0, min(2.0, event.delta_y))*SPEED
    else:
        if pointer.SKIP_DUPLICATE_SCROLL_EVENTS and self._client.wheel_smooth and event.get_pointer_emulated():
            return True
        movement = {Gdk.ScrollDirection.UP:(0,SPEED), Gdk.ScrollDirection.DOWN:(0,-SPEED),
                    Gdk.ScrollDirection.LEFT:(-SPEED,0), Gdk.ScrollDirection.RIGHT:(SPEED,0)}.get(event.direction)
        if movement is None:
            return original(self, event)
        x, y = movement
    if not hasattr(self, '_remote_scroll_budget'):
        self._remote_scroll_budget = ScrollBudget()
        self._client.wheel_deltax = self._client.wheel_deltay = 0
    now = time.monotonic()
    x, reset_x = self._remote_scroll_budget.limit('x', x, now)
    y, reset_y = self._remote_scroll_budget.limit('y', y, now)
    if reset_x:
        self._client.wheel_deltax = 0
    if reset_y:
        self._client.wheel_deltay = 0
    self._client.wheel_event(-1, self.wid, x, y, self.get_pointer_data(event))
    return True

pointer.PointerWindow._do_scroll_event = scroll
Logger('mouse').info('Tokyo scroll v4: %.0f%% linear, 3 notches/s, no queued tail', SPEED*100)
