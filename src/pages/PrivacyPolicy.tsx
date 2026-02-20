import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Política de Privacidade</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conformidade LGPD</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-4">
          <p>
            Esta Política de Privacidade descreve como coletamos, usamos e protegemos
            seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados
            (LGPD - Lei nº 13.709/2018).
          </p>

          <h3 className="font-semibold">1. Dados Coletados</h3>
          <p>Coletamos os seguintes dados pessoais: nome completo, email, telefone,
            dados profissionais (OAB/CRM), e dados necessários para a gestão de casos
            previdenciários.</p>

          <h3 className="font-semibold">2. Finalidade do Tratamento</h3>
          <p>Os dados são utilizados exclusivamente para: gerenciar o fluxo de trabalho
            entre advogados, médicos e especialistas; elaboração de laudos e pareceres;
            e comunicação entre profissionais envolvidos nos casos.</p>

          <h3 className="font-semibold">3. Base Legal</h3>
          <p>O tratamento de dados é baseado no consentimento do titular (Art. 7º, I da LGPD)
            e no cumprimento de obrigação legal ou regulatória.</p>

          <h3 className="font-semibold">4. Seus Direitos</h3>
          <p>Você tem direito a: acessar seus dados pessoais; corrigir dados incompletos
            ou desatualizados; solicitar a exclusão de seus dados (direito ao esquecimento);
            e revogar o consentimento a qualquer momento.</p>

          <h3 className="font-semibold">5. Segurança dos Dados</h3>
          <p>Implementamos medidas técnicas e organizacionais para proteger seus dados,
            incluindo criptografia, controle de acesso e logs de auditoria.</p>

          <h3 className="font-semibold">6. Retenção de Dados</h3>
          <p>Os dados são mantidos pelo período necessário para cumprimento das finalidades
            descritas. Após este período, são excluídos ou anonimizados.</p>

          <h3 className="font-semibold">7. Contato do Encarregado (DPO)</h3>
          <p>Para exercer seus direitos ou esclarecer dúvidas, entre em contato através
            da seção "Privacidade LGPD" no menu do sistema.</p>
        </CardContent>
      </Card>
    </div>
  );
}
