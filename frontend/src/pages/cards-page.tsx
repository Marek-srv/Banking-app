import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CreditCard, LoaderCircle, Plus } from "lucide-react";

import { accountApi } from "@/api/accountApi";
import { cardApi, type BankCard } from "@/api/cardApi";
import { CardActivity } from "@/components/cards/card-activity";
import { AddCardModal } from "@/components/cards/add-card-modal";
import { CardCarousel } from "@/components/cards/card-carousel";
import { CardControls } from "@/components/cards/card-controls";
import { CardStatusModal } from "@/components/cards/card-status-modal";
import { SelectedCardPanel } from "@/components/cards/selected-card-panel";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { useLogoutMutation } from "@/hooks/useAuthMutations";
import { useAuthenticatedCustomer } from "@/hooks/useAuthenticatedCustomer";

export function CardsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>();
  const [confirmationCard, setConfirmationCard] = useState<BankCard | null>(null);
  const [onlinePayments, setOnlinePayments] = useState<Record<string, boolean>>({});
  const [contactless, setContactless] = useState<Record<string, boolean>>({});
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const logoutMutation = useLogoutMutation();
  const queryClient = useQueryClient();
  const customerQuery = useAuthenticatedCustomer();
  const cardholderName = (customerQuery.data?.name || "π Bank Customer").toUpperCase();

  const cardsQuery = useQuery({ queryKey: ["cards"], queryFn: cardApi.listCards, staleTime: 30_000 });
  const cardRequestsQuery = useQuery({ queryKey: ["card-requests"], queryFn: cardApi.listRequests, staleTime: 20_000 });
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: accountApi.listAccounts, staleTime: 30_000 });
  const transactionsQuery = useQuery({ queryKey: ["transactions", "cards-page", "recent"], queryFn: () => accountApi.listTransactions(), staleTime: 20_000 });

  useEffect(() => {
    const cards = cardsQuery.data ?? [];
    if (cards.length > 0 && (!selectedCardId || !cards.some((card) => card.cardId === selectedCardId))) setSelectedCardId(cards[0].cardId);
  }, [cardsQuery.data, selectedCardId]);

  const cardQuery = useQuery({
    queryKey: ["card", selectedCardId],
    queryFn: () => cardApi.getCard(selectedCardId!),
    enabled: Boolean(selectedCardId),
    staleTime: 20_000,
  });
  const selectedCard = cardQuery.data ?? cardsQuery.data?.find((card) => card.cardId === selectedCardId);
  const linkedAccount = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    if (selectedCard?.accountId) return accounts.find((account) => account.accountId === selectedCard.accountId);
    return accounts.length === 1 ? accounts[0] : undefined;
  }, [accountsQuery.data, selectedCard?.accountId]);
  const attributionAvailable = Boolean(linkedAccount);
  const recentActivity = useMemo(() => {
    if (!linkedAccount) return [];
    return (transactionsQuery.data ?? [])
      .filter((transaction) => transaction.sourceAccountId === linkedAccount.accountId)
      .slice(0, 4);
  }, [linkedAccount, transactionsQuery.data]);

  const statusMutation = useMutation({
    mutationFn: (card: BankCard) => card.cardStatus === "BLOCKED" ? cardApi.unblockCard(card.cardId) : cardApi.blockCard(card.cardId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["card", updated.cardId], updated);
      queryClient.setQueryData<BankCard[]>(["cards"], (cards) => cards?.map((card) => card.cardId === updated.cardId ? updated : card));
      setConfirmationCard(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["card", updated.cardId] }),
        queryClient.invalidateQueries({ queryKey: ["cards"] }),
      ]);
    },
  });

  const createCardMutation = useMutation({
    mutationFn: cardApi.createRequest,
    onSuccess: async () => {
      setAddCardOpen(false);
      setSuccessMessage("Card application submitted for bank approval.");
      await queryClient.invalidateQueries({ queryKey: ["card-requests"] });
    },
  });

  return (
    <div className="flex h-screen min-w-[1320px] overflow-hidden bg-bank-page">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onLogout={() => logoutMutation.mutate()} logoutPending={logoutMutation.isPending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Cards" subtitle="Manage your π Bank cards and payment controls" />
        <main className="min-h-0 flex-1 overflow-y-auto bg-bank-page px-5 py-3.5">
          <div className="mx-auto max-w-[1460px] space-y-3.5">
            <div className="flex items-center justify-end gap-3">
              {successMessage ? <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700" role="status"><CheckCircle2 size={15} /> {successMessage}</p> : null}
              <button type="button" onClick={() => { createCardMutation.reset(); setSuccessMessage(""); setAddCardOpen(true); }} disabled={accountsQuery.isLoading} className="inline-flex h-9 items-center gap-2 rounded-xl bg-bank-blue px-4 text-[11px] font-bold text-white shadow-[0_7px_18px_rgba(11,99,229,0.2)] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} /> Apply for Card</button>
            </div>
            {cardsQuery.isLoading ? <div className="flex min-h-[580px] items-center justify-center rounded-2xl border border-bank-border bg-white"><div className="text-center"><LoaderCircle size={28} className="mx-auto animate-spin text-bank-blue" /><p className="mt-3 text-xs font-semibold text-bank-muted">Loading your cards…</p></div></div> : null}
            {cardsQuery.isError ? <div className="flex min-h-[580px] items-center justify-center rounded-2xl border border-red-100 bg-white"><div className="text-center"><AlertCircle size={29} className="mx-auto text-red-500" /><p className="mt-3 text-sm font-bold text-bank-navy">Unable to load cards</p><p className="mt-1 text-xs text-bank-muted">Please check your connection and try again.</p><button type="button" onClick={() => cardsQuery.refetch()} className="mt-4 rounded-lg bg-bank-blue px-4 py-2 text-xs font-bold text-white">Try Again</button></div></div> : null}
            {!cardsQuery.isLoading && !cardsQuery.isError && cardsQuery.data?.length === 0 ? <div className="flex min-h-[580px] items-center justify-center rounded-2xl border border-bank-border bg-white"><div className="text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bank-light text-bank-blue"><CreditCard size={21} /></span><p className="mt-3 text-sm font-bold text-bank-navy">No cards found</p><p className="mt-1 text-xs text-bank-muted">Your π Bank cards will appear here after they are issued.</p></div></div> : null}

            {cardsQuery.data && cardsQuery.data.length > 0 ? (
              <>
                <CardCarousel cards={cardsQuery.data} selectedCardId={selectedCardId} cardholderName={cardholderName} onSelect={setSelectedCardId} />
                {selectedCard ? (
                  <div className="grid grid-cols-[minmax(650px,1.35fr)_minmax(355px,0.65fr)] gap-3.5">
                    <SelectedCardPanel card={selectedCard} linkedAccount={linkedAccount} cardholderName={cardholderName} />
                    <div className="space-y-3.5">
                      <CardControls
                        card={selectedCard}
                        onlinePayments={onlinePayments[selectedCard.cardId] ?? true}
                        contactless={contactless[selectedCard.cardId] ?? true}
                        onOnlinePaymentsChange={() => setOnlinePayments((values) => ({ ...values, [selectedCard.cardId]: !(values[selectedCard.cardId] ?? true) }))}
                        onContactlessChange={() => setContactless((values) => ({ ...values, [selectedCard.cardId]: !(values[selectedCard.cardId] ?? true) }))}
                        onChangeBlockStatus={() => { statusMutation.reset(); setConfirmationCard(selectedCard); }}
                      />
                      <CardActivity transactions={recentActivity} loading={transactionsQuery.isLoading} attributionAvailable={attributionAvailable} />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            {cardRequestsQuery.data?.length ? <section className="rounded-2xl border border-bank-border bg-white p-4"><h2 className="text-sm font-extrabold text-bank-navy">Card Request History</h2><div className="mt-3 space-y-2">{cardRequestsQuery.data.map(request=><div key={request.card_request_id} className="flex items-center justify-between rounded-xl border p-3 text-xs"><span>{request.card_type} card request<small className="block text-bank-muted">{new Date(request.created_at).toLocaleDateString("en-IN")}</small></span><span className="font-bold text-bank-navy">{request.status}</span></div>)}</div></section>:null}
          </div>
        </main>
      </div>
      <CardStatusModal card={confirmationCard} pending={statusMutation.isPending} error={statusMutation.error} onClose={() => !statusMutation.isPending && setConfirmationCard(null)} onConfirm={() => confirmationCard && !statusMutation.isPending && statusMutation.mutate(confirmationCard)} />
      <AddCardModal
        open={addCardOpen}
        accounts={accountsQuery.data ?? []}
        pending={createCardMutation.isPending}
        error={createCardMutation.error}
        onClose={() => !createCardMutation.isPending && setAddCardOpen(false)}
        onSubmit={(input) => createCardMutation.mutate(input)}
      />
    </div>
  );
}
