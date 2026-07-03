import { NextResponse } from 'next/server';
import { getCertificateForDownload, renderCertificatePdf } from '@lumora/domain';
import { defineRoute } from '@/server/route';

/**
 * GET /api/v1/certificates/{certificateId}/download.
 * Unlike /certificates/verify/{code} (intentionally public, FR-CERT-02), a
 * downloadable PDF contains the student's name and grade — authentication and
 * ownership/staff authorization are required (NFR-PRIV-02).
 */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => {
    const data = await getCertificateForDownload(ctx!, params.certificateId!);
    const pdf = renderCertificatePdf({
      studentName: data.studentName,
      courseTitle: data.courseTitle,
      verificationCode: data.certificate.verificationCode,
      issuedAt: data.certificate.issuedAt,
      finalGradePercent: data.certificate.finalGradePercent,
    });
    const bytes = new Uint8Array(pdf);
    const body = bytes.buffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lumora-certificate-${data.certificate.verificationCode}.pdf"`,
      },
    });
  },
);
