import { ScatterChart } from '@mui/x-charts';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

const MAX_SUPPORTED_RENDERS = 1000000;

const TEST_MAX_DEPTH = 2;

const TESTS = [true, false].flatMap((useMemoized) => {
  return Array.from({ length: TEST_MAX_DEPTH + 1 }, (_, depthLevel) => {
    return [1, 10, 100, 500, 1000].map((maxRenders) => {
      return { depthLevel, maxRenders, useMemoized };
    });
  }).flat();
});

console.log({ TESTS });

const COMPONENT_COUNT = 1000;
const list = new Array(COMPONENT_COUNT).fill(0);

type Result = {
  runId: number;
  depthLevel: number;
  maxRenders: number;
  useMemoized: boolean;
  time: number;
};

const results: Result[] = [];

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

const renders = {
  ComponentString: 0,
};

function ComponentString({
  name,
  nestedCount = 0,
}: {
  name: string;
  nestedCount?: number;
}) {
  renders.ComponentString++;

  return (
    <div style={{ display: 'flex' }}>
      {name} --
      {nestedCount !== 0 && (
        <ComponentString
          name={name + nestedCount}
          nestedCount={nestedCount - 1}
        />
      )}
    </div>
  );
}

const MemoizedComponentString = memo(ComponentString);

const RenderCounter = () => {
  const [, trigger] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      trigger((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return renders.ComponentString.toLocaleString();
};

function Scatter() {
  return (
    <ScatterChart
      width={600}
      height={300}
      bottomAxis={{ label: 'Time (ms)' }}
      leftAxis={{ label: 'Re-renders' }}
      xAxis={[{ scaleType: 'log' }]}
      yAxis={[{ scaleType: 'log' }]}
      series={[
        {
          label: 'Memoized',
          color: 'blue',
          data: results
            .filter(({ useMemoized }) => useMemoized)
            .map((v) => ({
              x: v.time,
              y: v.maxRenders,
              id: v.runId,
              z: v.depthLevel,
            })),
        },
        {
          label: 'Not memoized',
          color: 'red',
          data: results
            .filter(({ useMemoized }) => !useMemoized)
            .map((v) => ({
              x: v.time,
              y: v.maxRenders,
              id: v.runId,
              z: v.depthLevel,
            })),
        },
      ]}
    />
  );
}

const Results = memo(
  ({
    depthLevel,
    inProgress,
    maxRenders,
    reset,
    setDepthLevel,
    setMaxRenders,
    runAutomatic,
    setUseMemoized,
    time,
    useMemoized,
  }: {
    depthLevel: number;
    inProgress: boolean;
    maxRenders: number;
    reset: () => void;
    setDepthLevel: (value: number) => void;
    setMaxRenders: (value: number) => void;
    runAutomatic: () => void;
    setUseMemoized: (value: boolean) => void;
    time: number;
    useMemoized: boolean;
  }) => {
    console.count('Results render');

    return (
      <div>
        <button onClick={reset}>Reset</button>{' '}
        <button onClick={runAutomatic}>Run automatic</button>
        {inProgress && 'In progress...'}
        <div>
          <label>
            Use memoized
            <input
              type="checkbox"
              checked={useMemoized}
              onChange={(e) => setUseMemoized(e.target.checked)}
            />
          </label>
        </div>
        <div>
          <label>
            Depth level
            <input
              style={{ width: '50px' }}
              value={depthLevel}
              onChange={(e) =>
                setDepthLevel(
                  Math.min(parseInt(e.target.value), MAX_SUPPORTED_RENDERS)
                )
              }
            />
          </label>
        </div>
        <div>
          Time to execute
          {
            <input
              style={{ width: '50px' }}
              value={maxRenders}
              onChange={(e) => setMaxRenders(parseInt(e.target.value))}
            />
          }
          re-renders took: {time}ms (overhead included ~50ms per 1000 renders)
        </div>
        <div>
          Total component count in app:{' '}
          {((depthLevel + 1) * COMPONENT_COUNT).toLocaleString()} - render
          count: <RenderCounter />
        </div>
        <Scatter />
      </div>
    );
  }
);

function App() {
  const [randomKey, setRandomKey] = useState(() => getRandomInt(100000));
  const [renderCount, setRenderCount] = useState(1);
  const [time, setTime] = useState(() => new Date().getTime());
  const timerRef = useRef<number>(0);

  const [depthLevel, setDepthLevel] = useState(0);
  const [maxRenders, setMaxRenders] = useState(100);
  const [useMemoized, setUseMemoized] = useState(false);

  const [testIdx, setTestIdx] = useState(-1);

  const reset = useCallback(() => {
    setRenderCount(1);
    timerRef.current = new Date().getTime();
    renders.ComponentString = 0;
    setRandomKey(getRandomInt(100000));
  }, []);

  const runAutomatic = useCallback(() => {
    const testId = testIdx < 0 ? 0 : testIdx;
    const { depthLevel, maxRenders, useMemoized } = TESTS[testId];
    setDepthLevel(depthLevel);
    setMaxRenders(maxRenders);
    setUseMemoized(useMemoized);
    setTestIdx(testId + 1);
    reset();

    console.log('Run test:', { depthLevel, maxRenders, useMemoized });
  }, [reset, testIdx]);

  useEffect(() => {
    if (renderCount < maxRenders) {
      setRenderCount(renderCount + 1);
    } else if (timerRef.current !== 0) {
      const elapsed = new Date().getTime() - timerRef.current;
      setTime(elapsed);

      timerRef.current = 0;

      results.push({
        runId: results.length + 1,
        depthLevel,
        maxRenders,
        useMemoized,
        time: elapsed,
      });

      if (testIdx >= 0 && testIdx < TESTS.length) {
        runAutomatic();
      }

      if (testIdx >= TESTS.length) {
        setTestIdx(-1);
      }
    }
  }, [depthLevel, maxRenders, renderCount, runAutomatic, testIdx, useMemoized]);

  const Component = useMemoized ? MemoizedComponentString : ComponentString;

  return (
    <>
      <Results
        reset={reset}
        maxRenders={maxRenders}
        time={time}
        setMaxRenders={setMaxRenders}
        inProgress={renderCount < maxRenders}
        useMemoized={useMemoized}
        setUseMemoized={setUseMemoized}
        depthLevel={depthLevel}
        setDepthLevel={setDepthLevel}
        runAutomatic={runAutomatic}
      />
      {list.map((_, index) => (
        <Component
          key={randomKey + '-' + index}
          name={'Test' + index}
          nestedCount={depthLevel}
        />
      ))}
    </>
  );
}

export default App;
