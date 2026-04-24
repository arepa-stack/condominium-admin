'use client';

import { useEffect, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Paginator } from '@/components/ui/paginator';
import { Vote } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import { formatDate } from '@/lib/utils/format';
import { toast } from 'sonner';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { DecisionVote, PaginationMetadata } from '@/types/models';

const PAGE_SIZE = 20;

interface VotesListProps {
    decisionId: string;
    currentRound: number;
}

export function VotesList({ decisionId, currentRound }: VotesListProps) {
    const [votes, setVotes] = useState<DecisionVote[]>([]);
    const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const res = await decisionsService.listVotes(decisionId, {
                    page,
                    limit: PAGE_SIZE,
                });
                setVotes(res.data);
                setMetadata(res.metadata);
            } catch (err) {
                toast.error(getDecisionErrorMessage(err));
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [decisionId, page]);

    return (
        <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
                <h3 className="text-base font-semibold">
                    Votos — Ronda {currentRound}
                </h3>
            </div>

            {isLoading ? (
                <TableSkeleton />
            ) : (votes?.length ?? 0) === 0 ? (
                <EmptyState
                    icon={Vote}
                    title="Sin votos"
                    message="Aún no se han registrado votos para esta decisión."
                    className="py-10"
                />
            ) : (
                <>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Apartamento</TableHead>
                                <TableHead>Votante</TableHead>
                                <TableHead>Cotización votada</TableHead>
                                <TableHead>Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {votes?.map((vote) => (
                                <TableRow key={vote.id}>
                                    <TableCell className="font-medium">
                                        {vote.apartment_label}
                                    </TableCell>
                                    <TableCell>{vote.voted_by?.name ?? 'Usuario eliminado'}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs font-mono">
                                        {vote.quote_id.slice(0, 8)}…
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(vote.created_at, 'dd/MM/yyyy HH:mm')}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {metadata && metadata.totalPages > 1 && (
                        <div className="px-5 py-4 border-t border-border/60">
                            <Paginator
                                metadata={metadata}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}
