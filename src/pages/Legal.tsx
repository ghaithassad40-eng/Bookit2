import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShieldCheck, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  kind: "privacy" | "terms";
}

/**
 * Lightweight static Privacy / Terms page. The content is deliberately
 * generic placeholder text that any GCC business owner can adapt — the
 * goal of this MVP is to ship the route + bilingual structure so the
 * footer links resolve, not to ship the final legal copy.
 *
 * Real customers must replace the placeholder body with reviewed text from
 * counsel before going to production.
 */
export default function Legal({ kind }: Props) {
  const { t, dir, locale } = useI18n();
  const ar = locale === "ar";
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  const data = kind === "privacy"
    ? {
        icon: ShieldCheck,
        title: ar ? "سياسة الخصوصية" : "Privacy Policy",
        updated: ar ? "آخر تحديث: 15 مايو 2026" : "Last updated: 15 May 2026",
        sections: ar
          ? PRIVACY_SECTIONS_AR
          : PRIVACY_SECTIONS_EN,
      }
    : {
        icon: ScrollText,
        title: ar ? "الشروط والأحكام" : "Terms of Service",
        updated: ar ? "آخر تحديث: 15 مايو 2026" : "Last updated: 15 May 2026",
        sections: ar
          ? TERMS_SECTIONS_AR
          : TERMS_SECTIONS_EN,
      };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="container flex h-14 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/" className="inline-flex items-center gap-1.5">
              <BackArrow className="h-3.5 w-3.5" />
              {t("login.backToDemo")}
            </Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl py-12 sm:py-20">
        <div className="mb-8 flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
            <data.icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{data.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.updated}</p>
          </div>
        </div>

        <div className="prose-content space-y-8">
          {data.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold tracking-tight">{s.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

interface Section { heading: string; body: string; }

const PRIVACY_SECTIONS_EN: Section[] = [
  {
    heading: "What we collect",
    body: "When you book through Bookit, we collect the booking details (service, time, business), your contact info (name, phone, email), and the payment authorisation token returned by our gateway. We do not store full card numbers — those live with our PCI-DSS certified payment partner.",
  },
  {
    heading: "How we use it",
    body: "Booking details are shared with the business you're booking — they need them to honour your reservation. We use your contact details to send booking confirmations, reminders, and (only if you've left a review) display your name next to your testimonial.",
  },
  {
    heading: "Where it's stored",
    body: "All customer data is hosted on Supabase (PostgreSQL) in the EU region. Demo mode stores the same data in your browser's localStorage and never leaves your device.",
  },
  {
    heading: "Your rights",
    body: "You can request access, export, or deletion of your data at any time by emailing privacy@bookit.example. We will respond within 30 days.",
  },
  {
    heading: "Cookies",
    body: "We use a minimal set of first-party cookies / localStorage to remember your country, language preference, and active session. We do not use third-party tracking or advertising cookies.",
  },
];

const PRIVACY_SECTIONS_AR: Section[] = [
  {
    heading: "ما نجمعه",
    body: "عند الحجز عبر بكيت، نجمع تفاصيل الحجز (الخدمة، الوقت، النشاط)، بيانات التواصل (الاسم، الهاتف، البريد الإلكتروني)، ورمز التفويض الذي يُصدره مزوّد الدفع لدينا. لا نخزّن أرقام البطاقات كاملة — تبقى لدى شريك دفع معتمد PCI-DSS.",
  },
  {
    heading: "كيف نستخدمها",
    body: "تُشارَك تفاصيل الحجز مع النشاط الذي تحجز لديه لأنه يحتاجها لتأكيد موعدك. نستخدم بيانات التواصل لإرسال تأكيدات الحجوزات والتذكيرات، ولعرض اسمك بجانب تقييمك إذا اخترت ترك مراجعة.",
  },
  {
    heading: "أين تُحفظ",
    body: "جميع بيانات العملاء مستضافة على Supabase (PostgreSQL) في الاتحاد الأوروبي. في الوضع التجريبي تُحفظ البيانات في متصفّحك ولا تغادر جهازك.",
  },
  {
    heading: "حقوقك",
    body: "يمكنك طلب الاطّلاع على بياناتك أو تصديرها أو حذفها في أي وقت بمراسلة privacy@bookit.example. سنردّ خلال 30 يوماً.",
  },
  {
    heading: "ملفّات تعريف الارتباط",
    body: "نستخدم مجموعة محدودة من ملفّات الكوكيز / التخزين المحلّي لتذكّر بلدك ولغتك وجلستك. لا نستخدم تتبّع طرف ثالث ولا كوكيز إعلانية.",
  },
];

const TERMS_SECTIONS_EN: Section[] = [
  {
    heading: "Booking + cancellation",
    body: "When you confirm a booking on Bookit, you enter a service agreement with the business — not with Bookit. You can cancel your booking from the confirmation page; the refund is issued to your original payment method within 3–7 business days, subject to the business's cancellation window.",
  },
  {
    heading: "Payments + escrow",
    body: "Bookit holds every paid booking in escrow until the service window closes. The platform fee (typically 10%) is netted from the gross at release time; the rest is paid out to the business. If you cancel during the cancellation window, the full amount is refunded with no fee deduction.",
  },
  {
    heading: "Business owner obligations",
    body: "Business owners listed on Bookit are responsible for delivering the booked service at the scheduled time, maintaining accurate availability, and honouring posted prices. Repeated no-shows or cancellations by a business may result in account suspension.",
  },
  {
    heading: "Acceptable use",
    body: "You may not use Bookit to book on behalf of someone else without their consent, abuse the cancellation flow, post offensive reviews, or attempt to bypass platform fees. Accounts violating these rules can be limited or terminated.",
  },
  {
    heading: "Liability",
    body: "Bookit is a marketplace facilitator. We are not liable for the quality of services delivered by listed businesses, but we will mediate disputes in good faith and process refunds where appropriate.",
  },
];

const TERMS_SECTIONS_AR: Section[] = [
  {
    heading: "الحجز والإلغاء",
    body: "عند تأكيد الحجز عبر بكيت، يصبح عقد الخدمة بينك وبين النشاط لا بين بكيت ونفسك. يمكنك الإلغاء من صفحة التأكيد، وسيُعاد المبلغ إلى وسيلة الدفع الأصلية خلال 3–7 أيام عمل، وفقاً لنافذة الإلغاء التي حدّدها النشاط.",
  },
  {
    heading: "المدفوعات والضمان",
    body: "تحتفظ بكيت بكل دفعة في حساب الضمان حتى ينتهي وقت الخدمة. تُقتطع عمولة المنصّة (10٪ عادةً) من المجموع عند التحرير، والباقي يُحوَّل للنشاط. إذا ألغيت خلال نافذة الإلغاء، يُسترَدّ المبلغ كاملاً دون اقتطاع.",
  },
  {
    heading: "التزامات صاحب النشاط",
    body: "أصحاب الأنشطة على بكيت مسؤولون عن تقديم الخدمة في الموعد المحدّد، والمحافظة على دقة التوافر، واحترام الأسعار المنشورة. تكرار الغياب أو الإلغاء قد يؤدّي إلى تعليق الحساب.",
  },
  {
    heading: "الاستخدام المقبول",
    body: "لا يُسمح باستخدام بكيت للحجز نيابةً عن آخرين دون إذنهم، أو إساءة استخدام الإلغاء، أو نشر مراجعات مسيئة، أو محاولة تجاوز عمولة المنصّة. مخالفة هذه القواعد قد تؤدّي إلى تقييد الحساب أو إنهائه.",
  },
  {
    heading: "المسؤولية",
    body: "بكيت وسيط بين العملاء والأنشطة، ولسنا مسؤولين عن جودة الخدمة التي يقدّمها النشاط، لكننا نتدخّل لحلّ النزاعات بحسن نيّة ونعالج استرداد المبالغ عند الاقتضاء.",
  },
];
