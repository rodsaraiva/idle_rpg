import { useRef, useState, useEffect, useCallback } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';
import { lightTap, successNotification } from '../services/haptics';

type CellLayout = { x: number; y: number; width: number; height: number };

type UseDragDropGridResult<T> = {
  pan: Animated.ValueXY;
  dragging: boolean;
  draggingItem: T | null;
  // ghostSize optional for web to align ghost center: { w, h }
  startDrag: (item: T, pageX: number, pageY: number, ghostSize?: { w: number; h: number }) => void;
  cancelDrag: () => void;
  panHandlers: any;
  setContainerRef: (r: View | null) => void;
  setCellLayout: (index: number, layout: CellLayout) => void;
  hoveredIndex: number | null;
};

const IS_WEB = Platform.OS === 'web';

export function useDragDropGrid<T>(onDrop?: (item: T, droppedIndex: number) => void): UseDragDropGridResult<T> {
  const [dragging, setDragging] = useState(false);
  const [draggingItem, setDraggingItem] = useState<T | null>(null);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const containerRef = useRef<View | null>(null);
  const containerAbsRef = useRef<{ x: number; y: number } | null>(null);
  const cellLayouts = useRef<CellLayout[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const draggingRef = useRef(false);
  const draggingItemRef = useRef<T | null>(null);
  const onDropRef = useRef(onDrop);
  const webListenersRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null);
  const ghostSizeRef = useRef<{ w: number; h: number }>({ w: 100, h: 44 });

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const measureContainer = useCallback(() => {
    const r = containerRef.current;
    if (!r) {
      containerAbsRef.current = null;
      return;
    }
    if (IS_WEB) {
      try {
        const el = r as unknown as HTMLElement;
        const rect = el.getBoundingClientRect();
        containerAbsRef.current = { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
      } catch {
        containerAbsRef.current = null;
      }
      return;
    }
    try {
      // @ts-ignore measureInWindow exists on native
      r.measureInWindow((cx: number, cy: number) => {
        containerAbsRef.current = { x: cx, y: cy };
      });
    } catch {
      containerAbsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(measureContainer, 60);
    return () => clearTimeout(t);
  }, [measureContainer]);

  const performDropAssign = useCallback((mx: number, my: number) => {
    const car = containerAbsRef.current;
    if (!car) return -1;
    for (let i = 0; i < cellLayouts.current.length; i++) {
      const r = cellLayouts.current[i];
      const absX = car.x + r.x;
      const absY = car.y + r.y;
      if (mx >= absX && mx <= absX + r.width && my >= absY && my <= absY + r.height) {
        return i;
      }
    }
    return -1;
  }, []);

  const finishDrop = useCallback((droppedIndex: number) => {
    const item = draggingItemRef.current;
    const dropFn = onDropRef.current;
    if (droppedIndex !== -1 && item && dropFn) {
      const target = cellLayouts.current[droppedIndex];
      const car = containerAbsRef.current;
      if (target && car) {
        const ghostW = ghostSizeRef.current.w;
        const ghostH = ghostSizeRef.current.h;
        const targetX = car.x + target.x + target.width / 2 - ghostW / 2;
        const targetY = car.y + target.y + target.height / 2 - ghostH / 2;
        Animated.timing(pan, {
          toValue: { x: targetX, y: targetY },
          duration: 160,
          useNativeDriver: false,
        }).start(() => {
          try { dropFn(item, droppedIndex); } catch { /* swallow */ }
          try { successNotification(); } catch { /* non-critical */ }
          try {
            const { playSound } = require('../services/sound');
            if (playSound) playSound('chest_reveal' as any).catch(() => {});
          } catch { /* non-critical */ }
          clearDragState();
        });
        return;
      }
      try { dropFn(item, droppedIndex); } catch { /* swallow */ }
    }
    clearDragState();
  }, [pan]);

  const clearDragState = useCallback(() => {
    draggingRef.current = false;
    draggingItemRef.current = null;
    setDragging(false);
    setDraggingItem(null);
    pan.setValue({ x: 0, y: 0 });
    setHoveredIndex(null);
  }, [pan]);

  const removeWebListeners = useCallback(() => {
    if (webListenersRef.current) {
      window.removeEventListener('mousemove', webListenersRef.current.move);
      window.removeEventListener('mouseup', webListenersRef.current.up);
      window.removeEventListener('touchmove', webListenersRef.current.move as any);
      window.removeEventListener('touchend', webListenersRef.current.up as any);
      webListenersRef.current = null;
    }
    if (IS_WEB) {
      try {
        document.body.style.cursor = '';
      } catch {
        /* ignore */
      }
    }
  }, []);

  // cleanup on unmount
  useEffect(() => removeWebListeners, [removeWebListeners]);

  const startWebListeners = useCallback(() => {
    removeWebListeners();

    const onMove = (e: MouseEvent | TouchEvent) => {
      // normalize to page coordinates using client + scroll to match getBoundingClientRect usage
      if ('touches' in e) {
        try {
          (e as TouchEvent).preventDefault();
        } catch {
          /* ignore */
        }
      }
      const px =
        'touches' in e
          ? (e as TouchEvent).touches[0].clientX + window.scrollX
          : (e as MouseEvent).clientX + window.scrollX;
      const py =
        'touches' in e
          ? (e as TouchEvent).touches[0].clientY + window.scrollY
          : (e as MouseEvent).clientY + window.scrollY;
      const gw = ghostSizeRef.current.w;
      const gh = ghostSizeRef.current.h;
      pan.setValue({ x: px - gw / 2, y: py - gh / 2 - 8 });
      measureContainer();
      const idx = performDropAssign(px, py);
      setHoveredIndex(idx === -1 ? null : idx);
    };

    const onUp = (e: MouseEvent | TouchEvent) => {
      removeWebListeners();
      const px =
        'changedTouches' in e
          ? (e as TouchEvent).changedTouches[0].clientX + window.scrollX
          : (e as MouseEvent).clientX + window.scrollX;
      const py =
        'changedTouches' in e
          ? (e as TouchEvent).changedTouches[0].clientY + window.scrollY
          : (e as MouseEvent).clientY + window.scrollY;
      measureContainer();
      const droppedIndex = performDropAssign(px, py);
      finishDrop(droppedIndex);
    };

    window.addEventListener('mousemove', onMove as any);
    window.addEventListener('mouseup', onUp as any);
    window.addEventListener('touchmove', onMove as any, { passive: false });
    window.addEventListener('touchend', onUp as any);
    webListenersRef.current = { move: onMove as any, up: onUp as any };
    // show grabbing cursor while dragging
    if (IS_WEB) {
      try {
        document.body.style.cursor = 'grabbing';
      } catch {
        /* ignore */
      }
    }
  }, [pan, measureContainer, performDropAssign, finishDrop, removeWebListeners]);

  // PanResponder for native only
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => draggingRef.current,
      onMoveShouldSetPanResponder: () => draggingRef.current,
      onStartShouldSetPanResponderCapture: () => draggingRef.current,
      onMoveShouldSetPanResponderCapture: () => draggingRef.current,
      onPanResponderMove: (_, gs) => {
        const gw = ghostSizeRef.current.w;
        const gh = ghostSizeRef.current.h;
        pan.setValue({ x: gs.moveX - gw / 2, y: gs.moveY - gh / 2 - 8 });
        const idx = performDropAssign(gs.moveX, gs.moveY);
        setHoveredIndex(idx === -1 ? null : idx);
      },
      onPanResponderRelease: (_, gs) => {
        const droppedIndex = performDropAssign(gs.moveX, gs.moveY);
        finishDrop(droppedIndex);
      },
    })
  ).current;

  const startDrag = useCallback((item: T, pageX: number, pageY: number, ghostSize?: { w: number; h: number }) => {
    draggingItemRef.current = item;
    draggingRef.current = true;
    setDraggingItem(item);
    setDragging(true);
    if (ghostSize) ghostSizeRef.current = ghostSize;
    const gw = ghostSizeRef.current.w;
    const gh = ghostSizeRef.current.h;
    pan.setValue({ x: pageX - gw / 2, y: pageY - gh / 2 - 8 });
    measureContainer();
    if (IS_WEB) {
      startWebListeners();
    }
    try { lightTap(); } catch { /* non-critical */ }
  }, [pan, measureContainer, startWebListeners]);

  const cancelDrag = useCallback(() => {
    removeWebListeners();
    clearDragState();
  }, [removeWebListeners, clearDragState]);

  return {
    pan,
    dragging,
    draggingItem,
    startDrag,
    cancelDrag,
    panHandlers: IS_WEB ? {} : panResponder.panHandlers,
    setContainerRef: (r: View | null) => {
      containerRef.current = r;
      measureContainer();
    },
    setCellLayout: (index: number, layout: CellLayout) => {
      cellLayouts.current[index] = layout;
    },
    hoveredIndex,
  };
}
