import { useState } from "react";
import { Link } from "react-router";
import type { AgentDefinition } from "@/agents/catalog";
import { useDashboardAgent } from "@/agents/use-dashboard-agent";
import { AgentStatusSummary, StatusBadge } from "@/components/agent-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Holds its own connection to the agent, so each card updates independently. */
export function AgentCard({ definition }: { definition: AgentDefinition }) {
  const agent = useDashboardAgent(definition.slug);
  const [open, setOpen] = useState(false);
  const { RunForm } = definition;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{definition.title}</CardTitle>
        <CardDescription>{definition.description}</CardDescription>
        <CardAction>
          <StatusBadge status={agent.state?.status} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <AgentStatusSummary state={agent.state} />
      </CardContent>
      <CardFooter className="gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button disabled={!agent.state} />}>실행</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{definition.title} 실행</DialogTitle>
              <DialogDescription>{definition.description}</DialogDescription>
            </DialogHeader>
            <RunForm agent={agent} onSubmitted={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          render={<Link to={`/agent/${definition.slug}`} />}
          nativeButton={false}
        >
          상세
        </Button>
      </CardFooter>
    </Card>
  );
}
