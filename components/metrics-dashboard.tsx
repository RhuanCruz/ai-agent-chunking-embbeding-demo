import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateCost } from "@/lib/cost-utils";
import { cn } from "@/lib/utils";

interface MetricsDashboardProps {
    inputTokens: number;
    outputTokens: number;
    latency: number;
    className?: string;
}

export function MetricsDashboard({ inputTokens, outputTokens, latency, className }: MetricsDashboardProps) {
    const cost = calculateCost(inputTokens, outputTokens);
    const formattedCost = `$${cost.toFixed(8)}`;

    return (
        <div className={cn("grid gap-4", className || "md:grid-cols-3")}>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formattedCost}</div>
                    <p className="text-xs text-muted-foreground">
                        Est. based on Gemini 1.5 Flash
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {inputTokens + outputTokens}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {inputTokens} In / {outputTokens} Out
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Latency</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{latency}ms</div>
                    <p className="text-xs text-muted-foreground">
                        Response time
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
