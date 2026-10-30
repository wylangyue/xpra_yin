"""Bridge macOS text composition directly into the forwarded window."""
import os
import sys
import ctypes
import objc
from xpra.platform.darwin import setup_app_bundle_env
setup_app_bundle_env()
import mac_scroll
from xpra.os_util import gi_import
Gdk=gi_import('Gdk')
from AppKit import NSTextView, NSMakeRect, NSFont, NSColor
from xpra.client.gtk3.window.keyboard import KeyboardWindow
from xpra.log import Logger
log=Logger('keyboard')

lib=ctypes.CDLL(os.environ['XPRA_BUNDLE_CONTENTS']+'/Frameworks/libgdk-3.0.dylib')
lib.gdk_quartz_window_get_nswindow.argtypes=[ctypes.c_void_p]
lib.gdk_quartz_window_get_nswindow.restype=ctypes.c_void_p
capsule=ctypes.pythonapi.PyCapsule_GetPointer
capsule.argtypes=[ctypes.py_object,ctypes.c_char_p]
capsule.restype=ctypes.c_void_p
windows={}

class RemoteIMEView(NSTextView):
    def insertText_replacementRange_(self, value, replacement):
        # unmarkText may re-enter insertText with the raw preedit string.
        if getattr(self,'committing',False):return
        self.committing=True
        try:
            text=str(value.string() if hasattr(value,'string') else value)
            self.unmarkText()
            self.setString_('')
            self.setHidden_(True)
            if self.window():self.window().makeFirstResponder_(self.previous_responder)
            window=self.remote_window
            if window._client.readonly:return
            wid=window._client._window_to_id.get(window)
            if not wid:return
            for char in text:
                val=Gdk.unicode_to_keyval(ord(char))
                name=Gdk.keyval_name(val)
                for down in (True,False):
                    window._client.send('key-action',wid,name,down,[],val,char,0,0)
        finally:
            self.committing=False
    def setMarkedText_selectedRange_replacementRange_(self, value, selected, replacement):
        self.setHidden_(False)
        objc.super(RemoteIMEView,self).setMarkedText_selectedRange_replacementRange_(value,selected,replacement)
    def doCommandBySelector_(self, selector):
        self.command_unhandled=True

original=KeyboardWindow.init_window

def initialize(self,client,metadata,props):
    original(self,client,metadata,props)
    def ready(widget):
        pointer=capsule(self.get_window().__gpointer__,None)
        pointer=lib.gdk_quartz_window_get_nswindow(pointer)
        if not pointer:return
        native=objc.objc_object(c_void_p=pointer)
        view=RemoteIMEView.alloc().initWithFrame_(NSMakeRect(12,12,280,32))
        view.remote_window=self
        view.previous_responder=native.firstResponder()
        view.setRichText_(False)
        view.setFont_(NSFont.systemFontOfSize_(20))
        view.setBackgroundColor_(NSColor.textBackgroundColor())
        view.setHidden_(True)
        native.contentView().addSubview_(view)
        self.native_ime=view
        windows[int(objc.pyobjc_id(native))]=(self,native,view)
        log.info('Mac local IME bridge ready')
        # GTK restores maximized windows asynchronously. Clamp the outer Cocoa
        # frame after that restore, including its native title bar and origin.
        def fit_native_workarea():
            if int(objc.pyobjc_id(native)) not in windows:return False
            area=native.screen().visibleFrame()
            frame=native.frame()
            width=min(frame.size.width,area.size.width)
            height=min(frame.size.height,area.size.height)
            x=max(area.origin.x,min(frame.origin.x,area.origin.x+area.size.width-width))
            y=max(area.origin.y,min(frame.origin.y,area.origin.y+area.size.height-height))
            if (x,y,width,height)!=(frame.origin.x,frame.origin.y,frame.size.width,frame.size.height):
                native.setFrame_display_(NSMakeRect(x,y,width,height),True)
            return False
        GLib=gi_import('GLib')
        GLib.timeout_add(500,fit_native_workarea)
        GLib.timeout_add(1500,fit_native_workarea)
    self.connect('realize',ready)
    def cleanup(*args):
        for key,(win,native,view) in list(windows.items()):
            if win is self:
                view.inputContext().discardMarkedText()
                view.removeFromSuperview()
                del windows[key]
    self.connect('destroy',cleanup)
KeyboardWindow.init_window=initialize
consumed=set()
last_source=None

def monitor(event):
    global last_source
    native=event.window()
    if not native:return event
    record=windows.get(int(objc.pyobjc_id(native)))
    if not record:return event
    window,native,view=record
    if window._client.readonly:return event
    code=event.keyCode()
    identity=(int(objc.pyobjc_id(native)),code)
    if event.type()==11:
        if identity in consumed:
            consumed.discard(identity)
            return None
        return event
    # Command/Control shortcuts remain ordinary Xpra shortcuts.
    if code==63 or event.modifierFlags() & ((1<<20)|(1<<18)):
        return event
    context=view.inputContext()
    source=str(context.selectedKeyboardInputSource() or '')
    if source!=last_source:
        log.info('Mac local input source: %s',source)
        last_source=source
    if not view.hasMarkedText() and code in (36,48,51,53,76,115,116,117,119,121,123,124,125,126):return event
    if '.inputmethod.' not in source and not view.hasMarkedText():return event
    point=native.mouseLocationOutsideOfEventStream()
    frame=view.frame()
    content=native.contentView().bounds().size
    view.setFrameOrigin_((max(0,min(point.x,content.width-frame.size.width)),max(0,min(point.y-36,content.height-36))))
    view.command_unhandled=False
    view.was_composing=bool(view.hasMarkedText())
    view.setHidden_(False)
    focused=native.makeFirstResponder_(view)
    context.activate()
    view.keyDown_(event)
    if not view.command_unhandled:
        consumed.add(identity)
        return None
    return event

lib.gdk_quartz_event_get_nsevent.argtypes=[ctypes.c_void_p]
lib.gdk_quartz_event_get_nsevent.restype=ctypes.c_void_p
original_press=KeyboardWindow.handle_key_press_event
original_release=KeyboardWindow.handle_key_release_event

def handle_native(self,event):
    # PyGObject boxed GdkEvents hash to their underlying native pointer.
    pointer=lib.gdk_quartz_event_get_nsevent(hash(event))
    if not pointer:return False
    native_event=objc.objc_object(c_void_p=pointer)
    return monitor(native_event) is None

def press(self,window,event):
    try:
        if handle_native(self,event):return True
    except Exception:
        log.warn('Local IME handler failed; using ordinary keyboard events',exc_info=True)
    return original_press(self,window,event)

def release(self,window,event):
    try:
        if handle_native(self,event):return True
    except Exception:
        log.warn('Local IME release failed; using ordinary keyboard events',exc_info=True)
    return original_release(self,window,event)
KeyboardWindow.handle_key_press_event=press
KeyboardWindow.handle_key_release_event=release
# Max-size uses local window pixels, excluding the measured 32-point title bar.
# Recompute on every connection so old remote geometry cannot overflow the Mac.
if 'attach' in sys.argv and not any(a.startswith('--max-size') for a in sys.argv):
    from AppKit import NSScreen
    area=NSScreen.mainScreen().visibleFrame()
    limit=(int(area.size.width),max(100,int(area.size.height)-32))
    sys.argv.append('--max-size=%dx%d' % limit)
    log.info('Mac workarea content limit: %sx%s',*limit)
from xpra.scripts.main import main
sys.exit(main('xpra',sys.argv))

