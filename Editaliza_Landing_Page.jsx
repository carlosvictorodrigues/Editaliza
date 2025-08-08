import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Brain, CalendarClock, LineChart, Rocket, Shuffle, Target, NotepadText, BarChart3, BookOpenText, Timer, RefreshCcw, CircleHelp, ShieldCheck, Mail, Sparkles, ArrowRight, PlayCircle, Link as LinkIcon, Users, Coffee, Crown, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Landing focada em marketing e diferenciais competitivos
// Next.js: use como app/page.tsx

const Section = ({ id, className = "", children }: any) => (
  <section id={id} className={`w-full max-w-6xl mx-auto px-4 md:px-6 ${className}`}>{children}</section>
);

const bullets = [
  { icon: <CalendarClock className="h-5 w-5" />, title: "Cronograma automático", text: "Gera plano completo a partir das suas horas, pesos 1–5 e data da prova." },
  { icon: <Brain className="h-5 w-5" />, title: "Revisões 7/14/28", text: "Memória de longo prazo com sábado dedicado à revisão." },
  { icon: <Shuffle className="h-5 w-5" />, title: "Ciclo ponderado", text: "Matérias aparecem na frequência do peso. Zero rigidez semanal." },
  { icon: <BarChart3 className="h-5 w-5" />, title: "Radar de fraquezas", text: "Questões registradas viram um mapa de pontos fracos por tópico." },
  { icon: <RefreshCcw className="h-5 w-5" />, title: "Replanejar 1‑clique", text: "Atrasou? O algoritmo redistribui sem bagunçar tudo." },
  { icon: <NotepadText className="h-5 w-5" />, title: "Estudo ativo", text: "Diário de bordo, anotações e métricas por sessão." },
];

const faqs = [
  { q: "Mentoria humana ou Editaliza?", a: "A Editaliza automatiza a estratégia que um mentor faria: planejar, revisar, cobrar ritmo. Resultado: 24/7 por uma fração do preço." },
  { q: "O que é a prioridade 1–5?", a: "É o peso da disciplina no baralho. Peso 5 aparece ~5× mais que peso 1, mantendo foco e variedade." },
  { q: "E se eu perder dias?", a: "Use Replanejar. O sistema redistribui e preserva revisões e simulados." },
  { q: "Posso usar para várias provas?", a: "Sim. Planos ilimitados no Pro e alternância rápida no Painel." },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => setSent(true), 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* NAVBAR */}
      <div className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <Section className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 grid place-items-center text-white font-bold">E</div>
            <span className="font-semibold">Editaliza</span>
            <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">Estratégia automatizada</Badge>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#comparativo" className="hover:underline">Vantagens</a>
            <a href="#como-funciona" className="hover:underline">Como funciona</a>
            <a href="#metodologia" className="hover:underline">Metodologia</a>
            <a href="#precos" className="hover:underline">Planos</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden sm:inline-flex">Entrar</Button>
            <Button className="rounded-xl">Começar grátis</Button>
          </div>
        </Section>
      </div>

      {/* HERO */}
      <Section className="pt-16 pb-10">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <Badge className="mb-3" variant="secondary">
              <Sparkles className="h-4 w-4 mr-1" /> Pare de planejar. Comece a avançar.
            </Badge>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
              A estratégia de um mentor de elite, <span className="text-blue-700">automatizada</span> para você.
            </h1>
            <p className="mt-4 text-slate-600 text-lg">
              Tenha a <strong>organização e método</strong> de um mentor sem pagar R$ 800+ por mês. Cole o edital, defina <strong>pesos 1–5</strong> e suas horas: o motor cria um plano completo com <strong>revisões 7/14/28</strong>, simulados direcionados e projeção de conclusão. Marketing honesto: sem milagres — <strong>inteligência + ritmo</strong> para você executar.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button className="rounded-xl h-11 px-6">
                <Rocket className="h-4 w-4 mr-2" /> Começar teste grátis (7 dias)
              </Button>
              <Button variant="outline" className="rounded-xl h-11 px-6">
                <PlayCircle className="h-4 w-4 mr-2" /> Ver por dentro (2 min)
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Consistência acima de perfeição</div>
              <div className="hidden sm:flex items-center gap-2"><Timer className="h-4 w-4" /> Sessões de 50 minutos</div>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }} className="bg-white rounded-2xl shadow-xl border p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Projeção de conclusão</p>
                <p className="text-2xl font-bold">100% em 46 dias</p>
              </div>
              <Badge>Economize 8h/sem</Badge>
            </div>
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full w-[5%] bg-blue-600" />
            </div>
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              {[{ title: "Economia real", value: "até 90% vs. mentoria" }, { title: "Meta diária", value: "50 questões" }, { title: "Simulados", value: "direcionados + completos" }, { title: "Revisões", value: "sábados otimizados" }].map((k, i) => (
                <Card key={i} className="rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription>{k.title}</CardDescription>
                    <CardTitle className="text-xl">{k.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>
      </Section>

      {/* COMPARATIVO */}
      <Section id="comparativo" className="py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-extrabold">Editaliza vs. Mentorias & planilhas</h2>
          <p className="text-slate-600 mt-2">Mesma inteligência, <strong>uma fração do preço</strong>, disponível 24/7.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-2xl bg-white">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3"></th>
                <th className="text-left p-3">Editaliza</th>
                <th className="text-left p-3">Mentoria</th>
                <th className="text-left p-3">Planilhas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[ ["Preço mensal", "R$ 59,90 (7 dias grátis)", "R$ 500 – R$ 2.000", "R$ 0 – R$ 99"],
                 ["Disponibilidade", "24/7", "Limitada ao mentor", "Você por conta"],
                 ["Metodologia", "Revisões 7/14/28 + ciclo ponderado", "Depende do mentor", "Manual e frágil"],
                 ["Flexibilidade", "Replanejar 1‑clique, Reforçar", "Agenda fixa", "Sem automação"],
                 ["Prova social", "Métricas e projeção", "Depoimentos", "—"],
               ].map((row, i) => (
                <tr key={i}>
                  <td className="p-3 font-medium">{row[0]}</td>
                  <td className="p-3">{row[1]}</td>
                  <td className="p-3">{row[2]}</td>
                  <td className="p-3">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* COMO FUNCIONA */}
      <Section id="como-funciona" className="py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-4xl font-extrabold">Comece em 3 minutos</h2>
          <p className="text-slate-600 mt-2">Templates para concursos populares. Sem fricção, sem planilhas.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <Target className="h-6 w-6" />, title: "Configure seu plano", text: "Defina data, horas por dia e duração (50 min recomendados)." },
            { icon: <BookOpenText className="h-6 w-6" />, title: "Cole o edital e pesos 1–5", text: "Personalize prioridades por disciplina." },
            { icon: <Rocket className="h-6 w-6" />, title: "Gerar cronograma", text: "Estudo + revisões 7/14/28 + simulados direcionados e completos." },
          ].map((item, i) => (
            <Card key={i} className="rounded-2xl">
              <CardHeader>
                <div className="h-10 w-10 grid place-items-center rounded-xl bg-blue-50 text-blue-700">{item.icon}</div>
                <CardTitle className="mt-3">{item.title}</CardTitle>
                <CardDescription>{item.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      {/* METODOLOGIA */}
      <Section id="metodologia" className="py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-4xl font-extrabold">A ciência por trás do resultado</h2>
          <p className="text-slate-600 mt-2">Curva do esquecimento + Revisões + Ciclo ponderado + Estudo ativo.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <MethodCard icon={<Brain className="h-6 w-6" />} title="Curva do Esquecimento" desc="Revisões 7, 14 e 28 dias com sábado dedicado e reforço extra." items={["Agendamento automático", "Botão Reforçar", "Memória de longo prazo"]} />
          <MethodCard icon={<Shuffle className="h-6 w-6" />} title="Ciclo Ponderado" desc="Sem 'segunda é dia X'. Pesos 1–5 definem frequência e mantêm variedade." items={["Foco no que importa", "Zero rigidez", "Recuperação de atrasos"]} />
          <MethodCard icon={<LineChart className="h-6 w-6" />} title="Estudo Ativo & Métricas" desc="Registro de questões, radar por tópico e simulados que apontam buracos." items={["Radar por tópico", "Anotações por sessão", "Simulados direcionados"]} />
        </div>
      </Section>

      {/* DEPOIMENTOS */}
      <Section className="py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-extrabold">Resultados que viram rotina</h2>
          <p className="text-slate-600 mt-2">Foco, clareza e menos ansiedade.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Aline – TRT", text: "Parei de perder tempo decidindo. O sábado de revisão mudou o jogo." },
            { name: "João – TJ", text: "O comparativo de ritmo me fez ajustar as horas certas. Semana no trilho." },
            { name: "Marina – PF", text: "Simulados direcionados mostraram meus buracos. Subi 12 pontos." },
          ].map((t, i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="p-6">
                <p className="text-slate-700">“{t.text}”</p>
                <p className="mt-3 text-sm text-slate-500">{t.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* PLANOS */}
      <Section id="precos" className="py-14">
        <div className="mb-4 text-center"><Badge variant="secondary">7 dias grátis – cancele quando quiser</Badge></div>
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-4xl font-extrabold">Planos simples, preço honesto</h2>
          <p className="text-slate-600 mt-2">Menos que dois cafés por semana. Muito mais que 10× de valor em foco e organização.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <PricingCard title="Gratuito" price="R$ 0" desc="Ideal para começar já" features={["1 plano ativo", "Geração de cronograma", "Revisões 7/14/28", "Simulados direcionados"]} cta="Começar agora" />
          <PricingCard highlight title="Pro" price="R$ 59,90/mês" desc="Para rotina séria" features={["Planos ilimitados", "Radar de pontos fracos", "Replanejar 1‑clique", "Exportar para agenda", "Relatórios semanais", "Comunidade exclusiva"]} cta="Começar teste grátis" />
          <PricingCard title="Anual" price="R$ 599/ano" desc="2 meses de desconto" features={["Tudo do Pro", "Suporte prioritário", "Convites para betas"]} cta="Assinar anual" />
        </div>
      </Section>

      {/* CAPTURA DE LEAD */}
      <Section className="py-14">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl md:text-2xl font-bold">Entre na lista VIP</h3>
                <p className="text-slate-600 mt-2">Receba o convite do beta e o e-book <strong>“A Ciência da Aprovação”</strong>.</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Sem spam</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Cancelamento com 1 clique</li>
                </ul>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input required type="email" placeholder="Seu melhor e-mail" value={email} onChange={(e)=>setEmail(e.target.value)} className="pl-9 rounded-xl" />
                </div>
                <Button type="submit" className="rounded-xl h-11 px-6">Quero participar</Button>
                {sent && <span className="text-green-600 text-sm self-center">✅ Recebido! Em breve novidades.</span>}
              </form>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-4xl font-extrabold">Perguntas frequentes</h2>
          <p className="text-slate-600 mt-2">Decida sem enrolação.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {faqs.map((f, i) => (
            <Card key={i} className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center gap-2 text-slate-700"><CircleHelp className="h-5 w-5" /><CardTitle className="text-lg">{f.q}</CardTitle></div>
                <CardDescription className="pt-2">{f.a}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA FINAL */}
      <Section className="py-16">
        <div className="rounded-3xl border bg-gradient-to-br from-blue-600 to-indigo-600 p-8 md:p-12 text-white text-center">
          <h3 className="text-2xl md:text-4xl font-extrabold">Pronto para estudar com consistência, sem drama?</h3>
          <p className="mt-3 text-blue-100">Gere seu cronograma agora e deixe o algoritmo brigar com o tempo por você.</p>
          <div className="mt-6 flex justify-center">
            <Button className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl h-11 px-6">
              <Rocket className="h-4 w-4 mr-2" /> Começar grátis
            </Button>
          </div>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="border-t py-10">
        <Section className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 grid place-items-center text-white font-bold">E</div>
            <span>Editaliza © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:underline">Política de Privacidade</a>
            <a href="#" className="hover:underline">Termos</a>
            <a href="#" className="hover:underline">Suporte</a>
          </div>
        </Section>
      </footer>
    </div>
  );
}

function MethodCard({ icon, title, desc, items }: any) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="h-10 w-10 grid place-items-center rounded-xl bg-green-50 text-green-700">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <FeatureList items={items} />
      </CardContent>
    </Card>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {items.map((t, i) => (
        <li key={i} className="flex items-center gap-2">
          <Check className="h-4 w-4" /> {t}
        </li>
      ))}
    </ul>
  );
}

function PricingCard({ title, price, desc, features, cta, highlight = false }: any) {
  return (
    <Card className={`rounded-2xl ${highlight ? "ring-2 ring-blue-600" : ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {highlight && <Badge className="bg-blue-600">Recomendado</Badge>}
        </div>
        <div className="mt-2 text-3xl font-extrabold">{price}</div>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FeatureList items={features} />
        <Button className="w-full rounded-xl mt-4">{cta}</Button>
      </CardContent>
    </Card>
  );
}
