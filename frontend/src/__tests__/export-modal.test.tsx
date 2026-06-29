import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportModal } from '@/components/editor/ExportModal';

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => 'blob:preview-pdf');
const revokeObjectURLMock = vi.fn();

describe('ExportModal print profile requests', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
      text: async () => '<html><body>preview</body></html>',
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURLMock });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURLMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('normalizes legacy page number settings and includes footer/logo controls in preview requests', async () => {
    render(
      <ExportModal
        projectId={42}
        documentId={9}
        projectName="Runtime Guide"
        open
        onClose={vi.fn()}
        initialSettings={{
          page_numbers: false,
          include_cover_page: false,
          include_toc: true,
          h1_underline: false,
          footer_left: 'Internal',
          footer_center: 'Runtime Guide',
          footer_right: 'Confidential',
          header_center: 'Pagemark',
          logo_url: 'https://example.com/logo.png',
          logo_position: 'footer-right',
          logo_height: '70px',
          page_number_position: 'right',
          page_number_format: 'page-n',
          paper_size: 'letter',
          margins: 'wide',
        }}
      />,
    );

    expect(screen.getByLabelText('Page numbers')).not.toBeChecked();
    expect(screen.getByLabelText('Left footer')).toHaveValue('Internal');
    expect(screen.getByLabelText('Center footer')).toHaveValue('Runtime Guide');
    expect(screen.getByLabelText('Right footer')).toHaveValue('Confidential');
    expect(screen.getByLabelText('Logo placement')).toHaveValue('footer-right');
    expect(screen.getByLabelText('Page number position')).toHaveValue('right');
    expect(screen.getByLabelText('Page number format')).toHaveValue('page-n');
    expect(screen.getByLabelText('Paper size')).toHaveValue('letter');
    expect(screen.getByLabelText('Page margins')).toHaveValue('wide');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe('/projects/42/documents/9/export');
    expect(requestedUrl.searchParams.get('format')).toBe('pdf');
    expect(requestedUrl.searchParams.get('include_page_numbers')).toBe('false');
    expect(requestedUrl.searchParams.get('page_numbers')).toBeNull();
    expect(requestedUrl.searchParams.get('include_cover_page')).toBe('false');
    expect(requestedUrl.searchParams.get('h1_underline')).toBe('false');
    expect(requestedUrl.searchParams.get('footer_left')).toBe('Internal');
    expect(requestedUrl.searchParams.get('footer_center')).toBe('Runtime Guide');
    expect(requestedUrl.searchParams.get('footer_right')).toBe('Confidential');
    expect(requestedUrl.searchParams.get('header_center')).toBe('Pagemark');
    expect(requestedUrl.searchParams.get('logo_url')).toBe('https://example.com/logo.png');
    expect(requestedUrl.searchParams.get('logo_position')).toBe('footer-right');
    expect(requestedUrl.searchParams.get('logo_height')).toBe('70px');
    expect(requestedUrl.searchParams.get('page_number_position')).toBe('right');
    expect(requestedUrl.searchParams.get('page_number_format')).toBe('page-n');
    expect(requestedUrl.searchParams.get('paper_size')).toBe('letter');
    expect(requestedUrl.searchParams.get('margins')).toBe('wide');
  });

  it('refreshes preview requests when print profile controls change', async () => {
    render(
      <ExportModal
        projectId={42}
        documentId={9}
        projectName="Runtime Guide"
        open
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText('Left footer'), { target: { value: 'Draft' } });
    fireEvent.change(screen.getByLabelText('Page margins'), { target: { value: 'narrow' } });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));

    const requestedUrl = new URL(fetchMock.mock.calls.at(-1)?.[0] as string);
    expect(requestedUrl.searchParams.get('footer_left')).toBe('Draft');
    expect(requestedUrl.searchParams.get('margins')).toBe('narrow');
  });

  it('renders PDF preview blobs with an embedded PDF object', async () => {
    render(
      <ExportModal
        projectId={42}
        documentId={9}
        projectName="Runtime Guide"
        open
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(createObjectURLMock).toHaveBeenCalled());

    const preview = screen.getByTitle('Paged PDF preview');
    expect(preview.tagName).toBe('OBJECT');
    expect(preview).toHaveAttribute('data', 'blob:preview-pdf');
    expect(preview).toHaveAttribute('type', 'application/pdf');
  });

  it('shows readiness warnings and exports after acknowledgement', async () => {
    render(
      <ExportModal
        projectId={42}
        documentId={9}
        projectName="Runtime Guide"
        open
        onClose={vi.fn()}
        readinessSummary={{
          warningCount: 2,
          warnings: [
            '1 AI proposed change still need review.',
            'Quality report has not been run for this document.',
          ],
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.getByTestId('export-readiness-warning')).toHaveTextContent('Readiness warnings');

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(fetchMock).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByLabelText('I understand and want to export anyway.'));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
