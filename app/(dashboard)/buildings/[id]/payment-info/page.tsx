'use client';

import { useParams } from 'next/navigation';
import { PaymentInfoPage } from '@/components/payment-info/PaymentInfoPage';

export default function BuildingPaymentInfoPage() {
    const { id } = useParams<{ id: string }>();
    return <PaymentInfoPage buildingId={id} />;
}
