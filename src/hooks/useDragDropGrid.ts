import { useRef, useState, useEffect } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { lightTap, successNotification } from '../services/haptics';

type CellLayout = { x: number; y: number; width: number; height: number };

type UseDragDropGridResult<T> = {
  pan: Animated.ValueXY;
  dragging: boolean;
  draggingItem: T | null;
  startDrag: (item: T, pageX: number, pageY: number) => void;
  cancelDrag: () => void;
  panHandlers: any;
  setContainerRef: (r: View | null) => void;
  setCellLayout: (index: number, layout: CellLayout) => void;
  hoveredIndex: number | null;
};

export function useDragDropGrid<T>(onDrop?: (item: T, droppedIndex: number) => void): UseDragDropGridResult<T> {
  const [dragging, setDragging] = useState(false);
  const [draggingItem, setDraggingItem] = useState<T | null>(null);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const containerRef = useRef<View | null>(null);
  const containerAbsRef = useRef<{ x: number; y: number } | null>(null);
  const cellLayouts = useRef<CellLayout[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // refs to avoid stale closures inside PanResponder callbacks
  const draggingRef = useRef<boolean>(false);
  const draggingItemRef = useRef<T | null>(null);
  const onDropRef = useRef(onDrop);

  const measureContainer = () => {
    const r = containerRef.current;
    if (!r) {
      containerAbsRef.current = null;
      return;
    }
    try {
      // prefer measureInWindow (native), but fall back to DOM bounding rect on web
      // @ts-ignore measureInWindow may exist on native view refs
      if (typeof (r as any).measureInWindow === 'function') {
        (r as any).measureInWindow((cx: number, cy: number) => {
          containerAbsRef.current = { x: cx, y: cy };
        });
      } else if (typeof (r as any).getBoundingClientRect === 'function') {
        // web: DOM element
        const rect = (r as any).getBoundingClientRect();
        containerAbsRef.current = { x: rect.left, y: rect.top };
      } else {
        containerAbsRef.current = null;
      }
    } catch {
      containerAbsRef.current = null;
    }
  };

  useEffect(() => {
    // re-measure occasionally in case layout changes; caller can call setContainerRef to trigger
    const t = setTimeout(measureContainer, 60);
    return () => clearTimeout(t);
  }, []);

  // keep onDrop ref up to date
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const performDropAssign = (mx: number, my: number) => {
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
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => draggingRef.current,
      onMoveShouldSetPanResponder: () => draggingRef.current,
      // allow parent to capture the gesture when dragging starts in a child
      onStartShouldSetPanResponderCapture: () => draggingRef.current,
      onMoveShouldSetPanResponderCapture: () => draggingRef.current,
      onPanResponderMove: (_, gestureState) => {
        const mx = gestureState.moveX ?? (gestureState as any).clientX ?? 0;
        const my = gestureState.moveY ?? (gestureState as any).clientY ?? 0;
        // debug coords
        // eslint-disable-next-line no-console
        console.log('[useDragDropGrid] onPanResponderMove', { mx, my });
        pan.setValue({ x: mx - 40, y: my - 20 });
        const car = containerAbsRef.current;
        if (car) {
          const idx = performDropAssign(mx, my);
          setHoveredIndex(idx === -1 ? null : idx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const mx = gestureState.moveX ?? (gestureState as any).clientX ?? 0;
        const my = gestureState.moveY ?? (gestureState as any).clientY ?? 0;
        // eslint-disable-next-line no-console
        console.log('[useDragDropGrid] onPanResponderRelease', { mx, my, hoveredIndex });
        const droppedIndex = performDropAssign(mx, my);
        const item = draggingItemRef.current;
        const dropFn = onDropRef.current;
        if (droppedIndex !== -1 && item && dropFn) {
          const target = cellLayouts.current[droppedIndex];
          const car = containerAbsRef.current!;
          const ghostW = 100;
          const ghostH = 44;
          const targetX = car.x + target.x + target.width / 2 - ghostW / 2;
          const targetY = car.y + target.y + target.height / 2 - ghostH / 2;
          Animated.timing(pan, {
            toValue: { x: targetX, y: targetY },
            duration: 160,
            useNativeDriver: false,
          }).start(() => {
            try {
              dropFn(item, droppedIndex);
            } catch {
              // swallow errors from consumer
            }
            try {
              successNotification();
            } catch {
              /* non-critical */
            }
            try {
              const { playSound } = require('../services/sound');
              if (playSound) playSound('chest_reveal' as any).catch(() => {});
            } catch {
              /* non-critical */
            }
            // clear refs and state
            draggingRef.current = false;
            draggingItemRef.current = null;
            setDragging(false);
            setDraggingItem(null);
            pan.setValue({ x: 0, y: 0 });
            setHoveredIndex(null);
          });
        } else {
          draggingRef.current = false;
          draggingItemRef.current = null;
          setDragging(false);
          setDraggingItem(null);
          pan.setValue({ x: 0, y: 0 });
          setHoveredIndex(null);
        }
      },
    })
  ).current;

  const startDrag = (item: T, pageX: number, pageY: number) => {
    // update refs first so PanResponder callbacks read latest values
    draggingItemRef.current = item;
    draggingRef.current = true;
    setDraggingItem(item);
    setDragging(true);
    pan.setValue({ x: pageX - 40, y: pageY - 20 });
    // ensure container absolute is measured
    measureContainer();
    // eslint-disable-next-line no-console
    console.log('[useDragDropGrid] startDrag', { id: (item as any)?.id, pageX, pageY, container: containerAbsRef.current });
    try {
      lightTap();
    } catch {
      /* non-critical */
    }
  };

  const cancelDrag = () => {
    draggingRef.current = false;
    draggingItemRef.current = null;
    setDragging(false);
    setDraggingItem(null);
    pan.setValue({ x: 0, y: 0 });
    setHoveredIndex(null);
  };

  return {
    pan,
    dragging,
    draggingItem,
    startDrag,
    cancelDrag,
    panHandlers: panResponder.panHandlers,
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

