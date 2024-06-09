import { Bar, BarTooltipProps } from '@nivo/bar';
import { BarChartHorizontalIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useIsDarkMode } from '@/hooks/theme';
import { formatTickBoundary, getBucketTicketsEstimatedTime, getMinTickIntervalMarker, getThreadDisplayName, getTimeWeightedHistogram } from './chartingUtils';
import DebouncedResizeContainer from "@/components/DebouncedResizeContainer";
import { useAtomValue } from 'jotai';
import { dashPerfCursorAtom, dashSvRuntimeAtom } from './dashboardHooks';
import * as d3ScaleChromatic from 'd3-scale-chromatic';
import { SvRtPerfThreadNamesType } from '@shared/otherTypes';

/**
 * Types
 */
type ThreadPerfChartDatum = {
    bucket: string | number;
    value: number;
    color: string;
    count: number;
}

type ThreadPerfChartProps = {
    data: ThreadPerfChartDatum[];
    minTickIntervalMarker: number | undefined;
    width: number;
    height: number;
};


/**
 * Memoized nivo bar chart component
 */
const ThreadPerfChart = memo(({ data, minTickIntervalMarker, width, height }: ThreadPerfChartProps) => {
    const isDarkMode = useIsDarkMode();

    const CustomToolbar = (datum: BarTooltipProps<ThreadPerfChartDatum>) => {
        const lowerLimit = data.find((_, index) => index === datum.index - 1)?.bucket ?? 0;
        const upperLimit = datum.data.bucket;
        const pctString = (datum.value * 100).toFixed() + '%';
        return (
            <div className="p-3 text-gray-900 bg-white rounded-md shadow-md">
                <div>
                    Tick duration: <strong>{formatTickBoundary(lowerLimit)}</strong> ~ <strong>{formatTickBoundary(upperLimit)}</strong>
                </div>
                <div>
                    Time spent: <strong>~{pctString}</strong>
                </div>
                <div>
                    Tick count: {datum.data.count}
                </div>
            </div>
        );
    }

    //FIXME: temporarily disable the minTickIntervalMarker
    minTickIntervalMarker = undefined;

    if (!width || !height) return null;
    return (
        <Bar
            height={height}
            width={width}
            data={data}
            theme={{
                tooltip: { wrapper: { zIndex: 10000 } },
                text: {
                    fontSize: '12px',
                    fontWeight: 600,
                    fill: 'inherit',
                },
                grid: {
                    line: {
                        strokeDasharray: '8 6',
                        stroke: '#3F4146', //secondary
                        strokeOpacity: isDarkMode ? 1 : 0.25,
                        strokeWidth: 1,
                    },
                },
            }}
            indexBy="bucket"
            margin={{ top: 0, right: 25, bottom: 40, left: 60 }}
            layout="horizontal"
            valueFormat={'.1%'}
            colors={{ datum: 'data.color' }}
            colorBy='indexValue'
            borderWidth={0.5}
            borderColor={isDarkMode ? undefined : {
                from: 'color',
                modifiers: [['darker', 1]]
            }}
            axisBottom={{
                format: '.0%',
                legend: 'percent of total time',
                legendPosition: 'middle',
                legendOffset: 32,
            }}
            axisLeft={{ format: formatTickBoundary }}
            enableGridX={true}
            enableGridY={false}
            labelSkipWidth={25}
            labelSkipHeight={12}
            labelTextColor={{
                from: 'color',
                modifiers: [['darker', 1.6]]
            }}
            tooltip={CustomToolbar}
            markers={minTickIntervalMarker ? [
                {
                    axis: 'y',
                    value: minTickIntervalMarker,
                    lineStyle: {
                        stroke: 'black',
                        strokeWidth: 4,
                        strokeDasharray: '6 2',
                        strokeDashoffset: 1,
                    },
                    // legend: 'bad',
                    // legendPosition: 'top-right',
                    // textStyle: { fontSize: '16px' },
                },
                {
                    axis: 'y',
                    value: minTickIntervalMarker,
                    lineStyle: {
                        stroke: '#F513B3',
                        strokeWidth: 2,
                        strokeDasharray: '4 4',
                    },
                    // legend: 'good',
                    // legendPosition: 'bottom-right',
                    // textStyle: { fontSize: '16px' },
                },
            ] : undefined}
        />
    );
});



export default function ThreadPerfCard() {
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
    const [selectedThread, setSelectedThread] = useState<SvRtPerfThreadNamesType>('svMain');
    const svRuntimeData = useAtomValue(dashSvRuntimeAtom);
    const perfCursorData = useAtomValue(dashPerfCursorAtom);

    const chartData = useMemo(() => {
        if (!svRuntimeData) return null;
        if (!svRuntimeData.perfBoundaries || !svRuntimeData.perfBucketCounts || !svRuntimeData.perfMinTickTime) return null;

        const { perfBoundaries, perfBucketCounts, perfMinTickTime } = svRuntimeData;
        const minTickInterval = perfMinTickTime[selectedThread ?? 'svMain'];
        // const minTickInterval = 0.01;
        // const minTickInterval = 0.008333;
        // const minTickInterval = 0.2;
        const minTickIntervalMarker = getMinTickIntervalMarker(perfBoundaries, minTickInterval);
        const minTickIntervalIndex = perfBoundaries.findIndex(b => b === minTickIntervalMarker);
        let colorFunc: (bucketNum: number) => string;
        if (minTickIntervalIndex) {
            colorFunc = (bucketNum) => {
                const minTickIntervalNum = minTickIntervalIndex + 1;
                if (bucketNum <= minTickIntervalIndex) {
                    return d3ScaleChromatic.interpolateYlGn(1.1 - (bucketNum / minTickIntervalNum));
                } else {
                    return d3ScaleChromatic.interpolateYlOrRd(0.25 + (bucketNum - minTickIntervalNum) / (perfBoundaries.length - minTickIntervalNum));
                }
            };
        } else {
            colorFunc = (index) => d3ScaleChromatic.interpolateRdYlGn(1 - (index + 1) / perfBoundaries.length);
        }

        const threadBucketCounts = perfBucketCounts[selectedThread ?? 'svMain'];
        let threadHistogram: number[];
        if (perfCursorData) {
            threadHistogram = perfCursorData.snap.weightedPerf;
        } else {
            const bucketTicketsEstimatedTime = getBucketTicketsEstimatedTime(perfBoundaries);
            threadHistogram = getTimeWeightedHistogram(threadBucketCounts, bucketTicketsEstimatedTime);
        }

        const data: ThreadPerfChartDatum[] = [];
        for (let i = 0; i < perfBoundaries.length; i++) {
            data.push({
                bucket: perfBoundaries[i],
                count: perfCursorData ? 0 : threadBucketCounts[i],
                value: threadHistogram[i],
                color: colorFunc(i+1),
            });
        }
        return { data, minTickIntervalMarker, perfBoundaries };
    }, [svRuntimeData, perfCursorData]);

    const threadDisplayName = getThreadDisplayName(selectedThread);
    return (
        <div className="py-2 rounded-lg border bg-card shadow-sm flex flex-col col-span-3 fill-primary h-[22rem] max-h-[22rem]">
            <div className="px-4 flex flex-row items-center justify-between space-y-0 pb-2 text-muted-foreground">
                <h3 className="tracking-tight text-sm font-medium line-clamp-1">
                    {threadDisplayName} Thread Performance (last minute)
                </h3>
                <div className='hidden xs:block'><BarChartHorizontalIcon /></div>
            </div>
            <DebouncedResizeContainer onDebouncedResize={setChartSize}>
                <ThreadPerfChart {...chartData} width={chartSize.width} height={chartSize.height} />
            </DebouncedResizeContainer>
        </div>
    );
}